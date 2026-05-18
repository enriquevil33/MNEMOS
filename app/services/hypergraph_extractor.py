from app.extensions import db
from app.models.knowledge_graph import Concept, HyperEdge, HyperEdgeMember
from app.models.document import Document
from app.models.chunk import Chunk
from app.services.llm_client import get_llm_client
from app.services.embedder import EmbedderService
import json
import logging
import re
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

BATCH_SIZE = 4
MAX_WORKERS = 5

HYPERGRAPH_SCHEMA = {
    "name": "hypergraph_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source": {"type": "array", "items": {"type": "string"}},
                        "relation": {"type": "string"},
                        "target": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["source", "relation", "target"],
                    "additionalProperties": False
                }
            },
            "definitions": {
                "type": "object",
                "additionalProperties": {"type": "string"}
            }
        },
        "required": ["events", "definitions"],
        "additionalProperties": False
    }
}


def _build_prompt(context_text: str) -> str:
    return """
    You are a network ontology graph maker. Analyze the text to extract scientific knowledge.

    Tasks:
    1. Identify specific assertions (Source -> Relation -> Target).
    2. Extract definitions for technical concepts.

    CRITICAL: Output ONLY valid JSON.
    EXACT Structure:
    {
      "events": [
        { "source": ["concept A"], "relation": "relates to", "target": ["concept B"] }
      ],
      "definitions": {
        "concept A": "definition text here"
      }
    }

    Rules:
    - Use precise technical terms.
    - IMPORTANT: Keep concept names and relations in the SAME LANGUAGE as the source text. Do NOT translate them to English.
    - Normalize names (e.g., "this protein" -> "Protein X").
    - Capture up to 10 most important events per batch.
    - DO NOT output multiple JSON objects. MERGE them into one.

    Text:
    """ + context_text


def _parse_response(response: str):
    """Robust JSON parsing with bracket trimming and numeric-key repair."""
    clean = re.sub(r"//.*", "", response.strip())
    start_idx = clean.find("{")
    end_idx = clean.rfind("}")
    if start_idx == -1 or end_idx == -1:
        raise json.JSONDecodeError("No JSON braces found", clean, 0)
    clean = clean[start_idx:end_idx + 1]
    clean = re.sub(r',\s*(\d+):', r', "target":', clean)
    clean = re.sub(r'\{\s*"source"([^}]+)\s+(\d+):', r'{ "source"\1 "target":', clean)
    return json.loads(clean)


def _extract_batch(batch_idx: int, total: int, context_text: str, first_chunk_id, llm):
    """
    Pass 1 worker: pure LLM call + parse. NO DB writes.
    LLM client is passed in from the main thread to avoid thread-local client
    contamination (workers may inherit stale clients from prior tasks).
    Returns (batch_idx, first_chunk_id, events, definitions) or None on failure.
    """
    logger.info(f"Hypergraph batch {batch_idx + 1}/{total} extracting...")
    try:
        response = llm.chat(
            system="You are an expert scientific knowledge graph builder. Output only valid JSON.",
            messages=[{"role": "user", "content": _build_prompt(context_text)}],
            json_schema=HYPERGRAPH_SCHEMA
        )
        try:
            data = _parse_response(response)
        except Exception as e:
            logger.warning(f"Batch {batch_idx}: parse failed ({e}). Retrying once.")
            retry_prompt = f"""
            The previous JSON output had an error: {e}
            Output VALID JSON only matching this structure:
            {{"events": [{{"source": ["A"], "relation": "r", "target": ["B"]}}], "definitions": {{"A": "def"}}}}

            Previous attempt:
            {response[:500]}
            """
            retry = llm.chat(
                system="You are a JSON validator. Output only valid JSON.",
                messages=[{"role": "user", "content": retry_prompt}]
            )
            data = _parse_response(retry)

        return (batch_idx, first_chunk_id,
                data.get("events", []),
                data.get("definitions", {}))
    except Exception as e:
        logger.error(f"Batch {batch_idx} failed permanently: {e}")
        return None


def _coerce_definition(val):
    if isinstance(val, dict):
        val = val.get("definition") or val.get("description") or str(val)
    return str(val) if not isinstance(val, str) else val


class HypergraphExtractor:

    @staticmethod
    def process_document(document_id: str):
        """
        Two-pass extraction:
        1. Parallel LLM calls collect (events, definitions) into memory — no DB writes.
        2. Single-threaded dedup + insert (concepts batch-embedded, then hyperedges).
        Resume: batches whose first_chunk_id already has a HyperEdge are skipped.
        """
        try:
            oid = UUID(document_id) if isinstance(document_id, str) else document_id
            doc = db.session.get(Document, oid)
            if not doc:
                logger.warning(f"Document {document_id} not found.")
                return

            logger.info(f"Starting hypergraph extraction for doc {document_id}")

            chunks = db.session.query(Chunk).filter_by(document_id=doc.id).order_by(Chunk.chunk_index).all()
            if not chunks:
                if doc.summary:
                    logger.warning("No chunks; falling back to single-shot summary extraction.")
                    batches = [(doc.summary, None)]
                else:
                    logger.error("No content available for extraction.")
                    return
            else:
                batches = []
                for i in range(0, len(chunks), BATCH_SIZE):
                    grp = chunks[i:i + BATCH_SIZE]
                    text = "\n---\n".join([c.content for c in grp])
                    batches.append((text, grp[0].id))

            # Resume: skip batches whose first_chunk_id already produced a HyperEdge
            processed_ids = {
                row[0] for row in db.session.query(HyperEdge.source_chunk_id)
                .filter(HyperEdge.source_document_id == doc.id,
                        HyperEdge.source_chunk_id.isnot(None))
                .distinct().all()
            }
            todo = [(i, text, fcid) for i, (text, fcid) in enumerate(batches)
                    if fcid is None or fcid not in processed_ids]

            if not todo:
                logger.info("Hypergraph: all batches already processed, nothing to do.")
                return

            logger.info(f"Hypergraph: {len(todo)}/{len(batches)} batches to run "
                        f"({len(batches) - len(todo)} resumed from previous run).")

            # ---- PASS 1: parallel LLM extraction, no DB writes ----
            # Instantiate one fresh client in the main thread — all workers share
            # it so they can't inherit a stale thread-local client from prior tasks.
            llm = get_llm_client()
            results = []
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futures = {
                    ex.submit(_extract_batch, idx, len(batches), text, fcid, llm): idx
                    for (idx, text, fcid) in todo
                }
                for fut in as_completed(futures):
                    r = fut.result()
                    if r is not None:
                        results.append(r)

            if not results:
                logger.warning("Hypergraph: no batches produced usable output.")
                return

            # ---- PASS 2: single-threaded dedup + insert ----
            # Collect every concept name we'll need + best-available description
            name_to_def = {}
            for _, _, events, definitions in results:
                for k, v in definitions.items():
                    norm = k.strip().lower()
                    if not norm:
                        continue
                    if norm not in name_to_def or not name_to_def[norm]:
                        name_to_def[norm] = _coerce_definition(v)
                for ev in events:
                    srcs = ev.get("source", [])
                    tgts = ev.get("target", [])
                    if isinstance(srcs, str): srcs = [srcs]
                    if isinstance(tgts, str): tgts = [tgts]
                    for n in srcs + tgts:
                        norm = n.strip().lower()
                        if norm and norm not in name_to_def:
                            name_to_def[norm] = None

            embedder = EmbedderService()

            # Resolve existing concepts and fuzzy-match misses, batching embeds
            existing = {
                c.name: c for c in
                db.session.query(Concept).filter(Concept.name.in_(list(name_to_def.keys()))).all()
            }
            missing_names = [n for n in name_to_def if n not in existing]

            concept_lookup = dict(existing)
            if missing_names:
                # Batch-embed all missing names in one shot
                missing_embeds = embedder.embed(missing_names)
                for name, emb in zip(missing_names, missing_embeds):
                    # Fuzzy match against existing concepts
                    closest = db.session.query(Concept).order_by(
                        Concept.embedding.cosine_distance(emb)
                    ).limit(1).first()
                    matched = None
                    if closest:
                        dist = db.session.query(
                            Concept.embedding.cosine_distance(emb)
                        ).filter(Concept.id == closest.id).scalar()
                        if dist is not None and dist < 0.15:
                            matched = closest
                    if matched:
                        concept_lookup[name] = matched
                    else:
                        c = Concept(name=name)
                        c.embedding = emb
                        if name_to_def.get(name):
                            c.description = name_to_def[name]
                        db.session.add(c)
                        db.session.flush()
                        concept_lookup[name] = c

            # Backfill definitions on existing concepts that lacked one
            for name, defn in name_to_def.items():
                if not defn:
                    continue
                c = concept_lookup.get(name)
                if c and not c.description:
                    c.description = defn
                    db.session.add(c)

            db.session.flush()

            # Insert HyperEdges + members
            total_events = 0
            for batch_idx, first_chunk_id, events, _ in results:
                for ev in events:
                    srcs = ev.get("source", [])
                    tgts = ev.get("target", [])
                    relation = ev.get("relation", "relates to")
                    if isinstance(srcs, str): srcs = [srcs]
                    if isinstance(tgts, str): tgts = [tgts]
                    if not srcs or not tgts:
                        continue

                    src_norm = [s.strip().lower() for s in srcs if s and s.strip()]
                    tgt_norm = [t.strip().lower() for t in tgts if t and t.strip()]
                    members = []
                    seen = set()
                    for n in src_norm + tgt_norm:
                        c = concept_lookup.get(n)
                        if not c or c.id in seen:
                            continue
                        seen.add(c.id)
                        members.append(c)
                    if len(members) < 2:
                        continue

                    edge = HyperEdge(
                        description=f"{', '.join(srcs)} {relation} {', '.join(tgts)}",
                        source_document_id=doc.id,
                        source_chunk_id=first_chunk_id
                    )
                    db.session.add(edge)
                    db.session.flush()

                    for c in members:
                        role = "source" if c.name in src_norm else (
                               "target" if c.name in tgt_norm else "participant")
                        db.session.add(HyperEdgeMember(
                            hyper_edge_id=edge.id,
                            concept_id=c.id,
                            role=role
                        ))
                    total_events += 1

                # Commit per batch so partial progress persists for resume.
                # If the document was deleted mid-process, abort gracefully.
                if not db.session.get(Document, doc.id):
                    logger.warning(f"Document {doc.id} deleted mid-process; aborting hypergraph.")
                    db.session.rollback()
                    return
                db.session.commit()

            logger.info(f"Hypergraph extraction complete. Extracted {total_events} events "
                        f"across {len(results)} batches.")

        except Exception as e:
            logger.error(f"Error in HypergraphExtractor: {e}")
            db.session.rollback()

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.knowledge_graph import Concept, HyperEdge, HyperEdgeMember
from app.models.chunk import Chunk
from app.models.document import Document
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('wiki', __name__, url_prefix='/api/wiki')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _concept_to_stub(concept: Concept) -> dict:
    """Minimal representation for index / search results."""
    return {
        "id": str(concept.id),
        "name": concept.name,
        "description": concept.description or "",
    }


def _build_article(concept: Concept) -> dict:
    """
    Assemble a full article payload for a single concept.
    Relations  = HyperEdges that contain this concept (with peer concepts).
    Sources    = the Chunks that generated those edges (for citations).
    """
    # 1. All HyperEdges that reference this concept
    edges = (
        db.session.query(HyperEdge)
        .join(HyperEdgeMember, HyperEdgeMember.hyper_edge_id == HyperEdge.id)
        .filter(HyperEdgeMember.concept_id == concept.id)
        .options(joinedload(HyperEdge.members).joinedload(HyperEdgeMember.concept))
        .all()
    )

    relations = []
    related_concept_ids = set()
    source_chunk_ids = set()

    for edge in edges:
        peers = []
        for m in edge.members:
            if m.concept_id == concept.id:
                continue
            peers.append({"name": m.concept.name, "id": str(m.concept.id), "role": m.role or ""})
            related_concept_ids.add(m.concept_id)
        relations.append({
            "description": edge.description,
            "peers": peers,
            "source_document_id": str(edge.source_document_id) if edge.source_document_id else None,
            "source_chunk_id": str(edge.source_chunk_id) if edge.source_chunk_id else None,
        })
        if edge.source_chunk_id:
            source_chunk_ids.add(edge.source_chunk_id)

    # 2. Source chunks (the raw text that produced these relations)
    sources = []
    if source_chunk_ids:
        chunks = (
            db.session.query(Chunk)
            .filter(Chunk.id.in_(list(source_chunk_ids)))
            .all()
        )
        for ch in chunks:
            doc = db.session.get(Document, ch.document_id)
            sources.append({
                "chunk_id": str(ch.id),
                "content": ch.content,
                "page_number": ch.page_number,
                "start_time": ch.start_time,
                "end_time": ch.end_time,
                "document_id": str(ch.document_id),
                "document_title": (doc.tag or doc.original_filename) if doc else "Unknown",
                "file_type": str(doc.file_type) if doc and doc.file_type else None,
                "youtube_url": doc.youtube_url if doc else None,
            })

    # 3. Synthesize description from sources if empty
    description = concept.description or ""
    if not description:
        if sources:
            best = max(sources, key=lambda s: len(s.get("content", "")))
            snippet = best.get("content", "")[:500].strip()
            if snippet:
                description = snippet
        if not description:
            description = f"See {concept.name} in the sources below."

    # 4. Related concepts (direct peers, deduplicated)
    related = []
    if related_concept_ids:
        related_concepts = db.session.query(Concept).filter(Concept.id.in_(list(related_concept_ids))).all()
        related = [_concept_to_stub(c) for c in related_concepts]

    return {
        "id": str(concept.id),
        "name": concept.name,
        "description": description,
        "relations": relations,
        "sources": sources,
        "related": related,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.route('/concepts', methods=['GET'])
def list_concepts():
    """
    Alphabetical list of all concepts.
    Supports ?letter=<str> to filter by first letter (case-insensitive).
        - Use 'a'-'z' for letter filtering
        - Use '#' for concepts starting with non-letters
    Supports ?limit=<int>&offset=<int> for pagination.
    """
    letter = request.args.get('letter', '').strip().lower()
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    query = db.session.query(Concept).order_by(func.lower(Concept.name))

    if letter:
        if letter == '#':
            # Filter for concepts that don't start with a-z
            query = query.filter(~func.lower(Concept.name).op('REGEXP')('^[a-z]'))
        elif len(letter) == 1 and letter.isalpha():
            # Filter for concepts starting with the specified letter
            query = query.filter(func.lower(Concept.name).startswith(letter))

    total = query.count()
    concepts = query.offset(offset).limit(limit).all()

    return jsonify({
        "concepts": [_concept_to_stub(c) for c in concepts],
        "total": total,
        "offset": offset,
        "limit": limit,
    })


@bp.route('/article/<concept_name>', methods=['GET'])
def get_article(concept_name: str):
    """
    Full article for a concept.  Lookup is case-insensitive exact match first,
    then falls back to vector similarity if embeddings are available.
    """
    norm = concept_name.strip().lower()

    concept = db.session.query(Concept).filter(func.lower(Concept.name) == norm).first()

    if not concept:
        # Fuzzy fallback via vector similarity
        try:
            from app.services.embedder import EmbedderService
            embedder = EmbedderService()
            query_vec = embedder.embed([norm])[0]
            concept = (
                db.session.query(Concept)
                .order_by(Concept.embedding.cosine_distance(query_vec))
                .limit(1)
                .first()
            )
            if concept:
                dist = (
                    db.session.query(Concept.embedding.cosine_distance(query_vec))
                    .filter(Concept.id == concept.id)
                    .scalar()
                )
                if dist is None or dist > 0.4:
                    concept = None
        except Exception as e:
            logger.warning(f"Wiki fuzzy lookup failed: {e}")
            concept = None

    if not concept:
        return jsonify({"error": f"Article '{concept_name}' not found"}), 404

    return jsonify(_build_article(concept))


@bp.route('/search', methods=['GET'])
def search_concepts():
    """
    Hybrid search: prefix match first, then vector similarity.
    ?q=<query>&limit=<int>
    Returns ranked list of concept stubs.
    """
    q = request.args.get('q', '').strip().lower()
    limit = request.args.get('limit', 20, type=int)

    if not q:
        return jsonify({"results": [], "total": 0})

    # 1. Exact prefix matches (fast, deterministic)
    prefix_hits = (
        db.session.query(Concept)
        .filter(func.lower(Concept.name).startswith(q))
        .order_by(func.lower(Concept.name))
        .limit(limit)
        .all()
    )

    seen_ids = {c.id for c in prefix_hits}
    results = [_concept_to_stub(c) for c in prefix_hits]

    # 2. If we still have room, fill with vector similarity
    if len(results) < limit:
        try:
            from app.services.embedder import EmbedderService
            embedder = EmbedderService()
            query_vec = embedder.embed([q])[0]

            vector_hits = (
                db.session.query(Concept)
                .filter(Concept.id.notin_(list(seen_ids)))
                .order_by(Concept.embedding.cosine_distance(query_vec))
                .limit(limit - len(results))
                .all()
            )
            # Only include if distance is reasonable (< 0.5)
            for c in vector_hits:
                dist = (
                    db.session.query(Concept.embedding.cosine_distance(query_vec))
                    .filter(Concept.id == c.id)
                    .scalar()
                )
                if dist is not None and dist < 0.5:
                    results.append(_concept_to_stub(c))
        except Exception as e:
            logger.warning(f"Wiki vector search failed: {e}")

    return jsonify({"results": results, "total": len(results)})

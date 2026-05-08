from flask import Blueprint, request, jsonify
from app.services.reasoning_engine import ReasoningEngine
from config.settings import settings
import logging
import json
import redis

logger = logging.getLogger(__name__)
bp = Blueprint('reasoning', __name__, url_prefix='/api/reasoning')

_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
_REPROCESS_KEY = "mnemos:reprocessing_status"


def get_reprocessing_status() -> dict:
    val = _redis.get(_REPROCESS_KEY)
    return json.loads(val) if val else {"status": "idle"}


def set_reprocessing_status(value: dict, ttl: int = 3600):
    _redis.setex(_REPROCESS_KEY, ttl, json.dumps(value))

@bp.route('/traverse', methods=['POST'])
def traverse_graph():
    """
    Find a path between two concepts.
    Body: { "start": "ConceptA", "goal": "ConceptB" }
    """
    data = request.json
    start_concept = data.get('start')
    goal_concept = data.get('goal')
    collection_ids = data.get('collection_ids', [])
    save_to_chat = data.get('save_to_chat', False)
    use_semantic_leap = data.get('use_semantic_leap', False)
    max_depth = data.get('max_depth', 3)
    
    if not start_concept or not goal_concept:
        return jsonify({"error": "Missing start or goal concept"}), 400
        
    try:
        engine = ReasoningEngine()
        result = engine.traverse(start_concept, goal_concept, collection_ids=collection_ids, use_semantic_leap=use_semantic_leap, max_depth=max_depth)
        
        # Result is now a dict { "narrative": str, "graph_data": dict }
        if isinstance(result, str):
             # Handle error strings returned by traverse
             return jsonify({"narrative": result, "graph_data": None})
        
        # Auto-Save to Chat if requested
        conversation_id = None
        if save_to_chat:
            try:
                from app.models.conversation import Conversation, Message
                from app.extensions import db
                
                # Title: Reasoning: Start -> Goal
                title = f"Reasoning: {start_concept} -> {goal_concept}"
                conversation = Conversation(title=title)
                db.session.add(conversation)
                db.session.flush()
                
                # User Prompt
                msg_user = Message(
                    conversation_id=conversation.id,
                    role='user',
                    content=f"Find logical path from '{start_concept}' to '{goal_concept}'"
                )
                db.session.add(msg_user)
                
                # AI Response
                graph_content = result['graph_data']
                if graph_content:
                    graph_content['search_params'] = {
                        'max_depth': max_depth,
                        'use_semantic_leap': use_semantic_leap
                    }

                msg_ai = Message(
                    conversation_id=conversation.id,
                    role='assistant',
                    content=result['narrative'],
                    graph_data=graph_content
                )
                db.session.add(msg_ai)
                db.session.commit()
                conversation_id = str(conversation.id)
            except Exception as e:
                logger.error(f"Failed to save reasoning to chat: {e}")
                # Don't fail the request, just log it? Or maybe notify user.
                # We'll return the ID handling in the response so UI knows.

        response = result.copy()
        if conversation_id:
            response['conversation_id'] = conversation_id
            
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Traversal error: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/reprocess', methods=['POST'])
def reprocess_all():
    current = get_reprocessing_status()
    if current["status"] == "processing":
        return jsonify({"status": "processing", "message": "Already reprocessing..."})

    data = request.json or {}
    missing_only = data.get('missing_only', False)

    set_reprocessing_status({"status": "processing"})

    from flask import current_app
    app = current_app._get_current_object()

    import threading
    def run_reprocess():
        with app.app_context():
            try:
                from app.extensions import db
                from app.models.document import Document
                from app.services.hypergraph_extractor import HypergraphExtractor

                documents = db.session.query(Document).filter(Document.status == 'completed').all()

                if missing_only:
                    docs_with_edges = db.session.query(Document.id).filter(
                        Document.hyper_edges.any()
                    ).all()
                    already_processed = {str(row[0]) for row in docs_with_edges}
                    documents = [d for d in documents if str(d.id) not in already_processed]
                    logger.info(f"Missing-only mode: {len(documents)} documents to process (skipping {len(already_processed)} already extracted).")
                else:
                    from app.models.knowledge_graph import HyperEdgeMember, HyperEdge, Concept
                    db.session.query(HyperEdgeMember).delete()
                    db.session.query(HyperEdge).delete()
                    db.session.query(Concept).delete()
                    db.session.commit()
                    logger.info(f"Full rebuild: cleared hypergraph. Processing {len(documents)} documents.")

                for i, doc in enumerate(documents):
                    logger.info(f"[Reprocess] Extracting hypergraph for document {i+1}/{len(documents)}: {doc.original_filename} ({doc.id})")
                    HypergraphExtractor.process_document(str(doc.id))

                logger.info("Reprocessing complete.")
                set_reprocessing_status({"status": "completed"})
            except Exception as e:
                logger.error(f"Reprocessing failed: {e}")
                set_reprocessing_status({"status": "failed", "error": str(e)})

    thread = threading.Thread(target=run_reprocess)
    thread.start()

    return jsonify({"status": "processing", "message": "Reprocessing started in background"})

@bp.route('/reprocess/status', methods=['GET'])
def get_reprocess_status():
    return jsonify(get_reprocessing_status())

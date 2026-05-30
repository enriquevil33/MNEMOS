import logging
from flask import Blueprint, request, jsonify
from app.models.collection import Collection
from app.models.document import Document
from app.models.collection_document import collection_documents
from app.extensions import db
from sqlalchemy.exc import IntegrityError
from uuid import UUID

logger = logging.getLogger(__name__)

bp = Blueprint('collections', __name__, url_prefix='/api/collections')

@bp.route('/', methods=['GET'])
def list_collections():
    """List all collections."""
    logger.info("Listing collections")
    collections = db.session.query(Collection).order_by(Collection.name.asc()).all()
    return jsonify([c.to_dict() for c in collections])

@bp.route('/', methods=['POST'])
def create_collection():
    """Create a new collection."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    try:
        collection = Collection(
            name=data['name'],
            description=data.get('description')
        )
        db.session.add(collection)
        db.session.commit()
        logger.info(f"Collection created: {collection.id}")
        return jsonify(collection.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Collection with this name already exists'}), 409
    except Exception as e:
        logger.error(f"Error creating collection: {e}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/<string:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    """Update a collection."""
    data = request.get_json()
    collection = db.session.query(Collection).get(collection_id)
    
    if not collection:
        return jsonify({'error': 'Collection not found'}), 404

    try:
        if 'name' in data:
            collection.name = data['name']
        if 'description' in data:
            collection.description = data['description']
        
        db.session.commit()
        logger.info(f"Collection updated: {collection_id}")
        return jsonify(collection.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Collection name conflict'}), 409
    except Exception as e:
        logger.error(f"Error updating collection: {e}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/<string:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    """Delete a collection. Junction rows cascade. Legacy FK cleared."""
    collection = db.session.query(Collection).get(collection_id)
    
    if not collection:
        return jsonify({'error': 'Collection not found'}), 404

    try:
        db.session.execute(
            collection_documents.delete().where(collection_documents.c.collection_id == collection.id)
        )
        db.session.delete(collection)
        db.session.commit()
        logger.info(f"Collection deleted: {collection_id}")
        return "", 204
    except Exception as e:
        logger.error(f"Error deleting collection: {e}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

@bp.route('/<string:collection_id>/documents', methods=['GET'])
def get_collection_documents(collection_id):
    """List documents in a collection."""
    collection = db.session.query(Collection).get(collection_id)
    if not collection:
        return jsonify({'error': 'Collection not found'}), 404
    return jsonify([doc.to_dict() for doc in collection.documents])

@bp.route('/<string:collection_id>/documents/<string:document_id>', methods=['POST'])
def add_document_to_collection(collection_id, document_id):
    """Add a document to a collection (many-to-many)."""
    try:
        collection = db.session.query(Collection).get(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found'}), 404
        doc = db.session.query(Document).get(document_id)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        if doc not in collection.documents:
            collection.documents.append(doc)
            db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding doc to collection: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/<string:collection_id>/documents/<string:document_id>', methods=['DELETE'])
def remove_document_from_collection(collection_id, document_id):
    """Remove a document from a collection."""
    try:
        collection = db.session.query(Collection).get(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found'}), 404
        doc = db.session.query(Document).get(document_id)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        if doc in collection.documents:
            collection.documents.remove(doc)
            db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing doc from collection: {e}")
        return jsonify({'error': str(e)}), 500

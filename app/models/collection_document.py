from app.extensions import db
from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

collection_documents = db.Table(
    'collection_documents',
    Column('collection_id', UUID(as_uuid=True), db.ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
    Column('document_id', UUID(as_uuid=True), db.ForeignKey('documents.id', ondelete='CASCADE'), primary_key=True),
    UniqueConstraint('collection_id', 'document_id', name='uq_collection_document')
)

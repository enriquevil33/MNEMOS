from sqlalchemy import Column, String, Text, Integer, ForeignKey, Index, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
from app.extensions import db

class DocumentSection(db.Model):
    __tablename__ = 'document_sections'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id', ondelete='CASCADE'), nullable=False)
    
    title = Column(String(500))  # Increased from 255 to allow longer LLM-generated titles
    content = Column(Text) # The summary of the section
    start_page = Column(Integer)
    end_page = Column(Integer)
    
    # New Metadata for improved granularity
    metadata_ = Column(JSONB) # e.g. { "key_concepts": [], "source_map": [] }
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    document = relationship('app.models.document.Document', backref=db.backref('sections', cascade='all, delete-orphan'))

    __table_args__ = (
        Index('ix_document_sections_metadata', metadata_, postgresql_using='gin'),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "content": self.content,
            "start_page": self.start_page,
            "end_page": self.end_page,
            "metadata": self.metadata_
        }

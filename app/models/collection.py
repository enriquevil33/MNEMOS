from app.extensions import db
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Text, DateTime, func, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

class Collection(db.Model):
    __tablename__ = 'collections'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship('Document', secondary='collection_documents', back_populates='collections')

    def to_dict(self):
        doc_count = len(self.documents) if self.documents else 0
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "document_count": doc_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

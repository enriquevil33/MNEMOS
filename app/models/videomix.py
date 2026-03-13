from sqlalchemy import Column, String, Text, DateTime, Enum, Integer, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from app.extensions import db
import enum


class VideoMixStatusEnum(enum.Enum):
    """Status enum for VideoMixProject."""
    draft = 'draft'
    generating_script = 'generating_script'
    script_ready = 'script_ready'
    rendering = 'rendering'
    completed = 'completed'
    error = 'error'


class RenderJobStatusEnum(enum.Enum):
    """Status enum for VideoMixRenderJob."""
    pending = 'pending'
    processing = 'processing'
    completed = 'completed'
    error = 'error'


class VideoMixProject(db.Model):
    """
    Represents a video mix project - a collection of video segments
    curated by the LLM based on user prompts.
    """
    __tablename__ = 'videomix_projects'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    user_prompt = Column(Text, nullable=False)  # Original user request

    # Document selection
    document_ids = Column(JSONB, nullable=False)  # List of document UUIDs

    # Export configuration
    resolution = Column(String(20), default='1080p')  # '1080p', '720p', '480p', 'source'
    title_cards_enabled = Column(Boolean, default=False)
    max_duration_seconds = Column(Integer)  # NULL = no limit
    audio_normalization = Column(Boolean, default=True)

    # Status
    status = Column(
        Enum(VideoMixStatusEnum),
        default=VideoMixStatusEnum.draft,
        nullable=False
    )
    error_message = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scripts = relationship(
        'VideoMixScript',
        back_populates='project',
        cascade='all, delete-orphan',
        order_by='VideoMixScript.version.desc()'
    )
    render_jobs = relationship(
        'VideoMixRenderJob',
        back_populates='project',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert model to dictionary for API responses."""
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "user_prompt": self.user_prompt,
            "document_ids": self.document_ids,
            "resolution": self.resolution,
            "title_cards_enabled": self.title_cards_enabled,
            "max_duration_seconds": self.max_duration_seconds,
            "audio_normalization": self.audio_normalization,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class VideoMixScript(db.Model):
    """
    Represents a version of a video mix script - the LLM-generated
    timeline of video segments with ordering and metadata.
    """
    __tablename__ = 'videomix_scripts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        db.ForeignKey('videomix_projects.id', ondelete='CASCADE'),
        nullable=False
    )
    version = Column(Integer, default=1, nullable=False)  # Iteration number

    # Script content (JSON structure with segments)
    script_data = Column(JSONB, nullable=False)
    """
    Expected structure:
    {
        "segments": [
            {
                "id": "seg_1",
                "document_id": "uuid",
                "chunk_id": "uuid",
                "start_time": 120.5,
                "end_time": 145.2,
                "title": "Introduction to War Concepts",
                "description": "Explains the basic definition of war",
                "order": 0,
                "title_card": {
                    "enabled": true,
                    "text": "Chapter 1: What is War?",
                    "duration": 3.0
                }
            }
        ],
        "total_duration": 300.5,
        "llm_reasoning": "Selected segments that progressively explain...",
        "reflection_history": [...],
        "transitions": "hard_cut"
    }
    """

    # Metadata
    total_duration = Column(Float)  # Seconds
    segment_count = Column(Integer)
    llm_reasoning = Column(Text)  # LLM's explanation for segment selection

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship('VideoMixProject', back_populates='scripts')

    def to_dict(self):
        """Convert model to dictionary for API responses."""
        # Extract segments from script_data for easier frontend access
        segments = self.script_data.get('segments', []) if self.script_data else []

        # Get llm_reasoning from either the column or script_data
        reasoning = self.llm_reasoning or (self.script_data.get('llm_reasoning', '') if self.script_data else '')

        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "version": self.version,
            "script_data": self.script_data,
            "segments": segments,  # Flattened for easier access
            "total_duration": self.total_duration or (self.script_data.get('total_duration', 0) if self.script_data else 0),
            "segment_count": self.segment_count or len(segments),
            "llm_reasoning": reasoning,
            "ai_reasoning": reasoning,  # Alias for chat component
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class VideoMixRenderJob(db.Model):
    """
    Represents a background rendering job for a video mix script.
    Tracks progress and output file information.
    """
    __tablename__ = 'videomix_render_jobs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        db.ForeignKey('videomix_projects.id', ondelete='CASCADE'),
        nullable=False
    )
    script_id = Column(
        UUID(as_uuid=True),
        db.ForeignKey('videomix_scripts.id', ondelete='CASCADE'),
        nullable=False
    )

    # Celery task info
    celery_task_id = Column(String(255), unique=True)

    # Status
    status = Column(
        Enum(RenderJobStatusEnum),
        default=RenderJobStatusEnum.pending,
        nullable=False
    )
    progress_percentage = Column(Integer, default=0)  # 0-100
    error_message = Column(Text)

    # Output
    output_filename = Column(String(512))  # Stored in UPLOAD_FOLDER/videomix_output/
    output_size_bytes = Column(db.BigInteger)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)

    # Relationships
    project = relationship('VideoMixProject', back_populates='render_jobs')
    script = relationship('VideoMixScript')

    def to_dict(self):
        """Convert model to dictionary for API responses."""
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "script_id": str(self.script_id),
            "celery_task_id": self.celery_task_id,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "progress_percentage": self.progress_percentage,
            "error_message": self.error_message,
            "output_filename": self.output_filename,
            "output_size_bytes": self.output_size_bytes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

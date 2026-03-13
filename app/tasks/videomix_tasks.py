from app.extensions import celery_app, db
from app.models.videomix import VideoMixProject, VideoMixScript, VideoMixRenderJob, VideoMixStatusEnum, RenderJobStatusEnum
from app.models.document import Document
from app.services.ffmpeg_service import FFmpegService
from config.settings import settings
import os
import logging
from uuid import UUID
from datetime import datetime

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def render_videomix_task(self, render_job_id: str):
    """
    Background task to render video mix.

    Steps:
    1. Extract all segments from source videos
    2. Generate title cards if enabled
    3. Concatenate all clips with audio normalization
    4. Clean up temporary files

    Args:
        self: Celery task instance (for progress updates)
        render_job_id: UUID of the VideoMixRenderJob

    Returns:
        Success message with output filename
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        job = None
        project = None
        temp_dir = None

        try:
            logger.info(f"Starting video mix render: {render_job_id}")

            # Load render job
            job = db.session.get(VideoMixRenderJob, UUID(render_job_id))
            if not job:
                logger.error(f"Render job not found: {render_job_id}")
                return "Render job not found"

            job.status = RenderJobStatusEnum.processing
            job.progress_percentage = 0
            db.session.commit()

            # Load script and project
            script = db.session.get(VideoMixScript, job.script_id)
            project = db.session.get(VideoMixProject, job.project_id)

            if not script or not project:
                raise Exception("Script or project not found")

            logger.info(f"Project: {project.title}")
            logger.info(f"Script version: {script.version}, segments: {script.segment_count}")
            logger.info(f"Project document_ids: {project.document_ids}")

            # Setup output directory
            output_dir = os.path.join(settings.UPLOAD_FOLDER, 'videomix_output')
            os.makedirs(output_dir, exist_ok=True)

            temp_dir = os.path.join(output_dir, f'temp_{render_job_id}')
            os.makedirs(temp_dir, exist_ok=True)

            ffmpeg = FFmpegService()
            segments = script.script_data.get('segments', [])

            if not segments:
                raise Exception("No segments in script")

            logger.info(f"Rendering {len(segments)} segments...")

            # Debug: Log segment document IDs
            for i, seg in enumerate(segments):
                logger.info(f"Segment {i}: document_id={seg.get('document_id')}, chunk_id={seg.get('chunk_id')}, title={seg.get('title')}")

            # Step 1: Extract segments and create title cards
            segment_files = []
            total_steps = len(segments)

            for i, segment in enumerate(segments):
                # Update progress (0-70% for extraction)
                progress = int((i / total_steps) * 70)
                self.update_state(state='PROGRESS', meta={'progress': progress})
                job.progress_percentage = progress
                db.session.commit()

                # Skip segments without valid document IDs (e.g., generated transitions/title cards)
                document_id = segment.get('document_id')
                if not document_id:
                    logger.warning(f"Skipping segment {i}: no document_id")
                    continue

                # Try to parse as UUID, skip if invalid (e.g., "generated-intro", "new-jesus-link")
                try:
                    doc_uuid = UUID(document_id)
                except (ValueError, AttributeError):
                    logger.warning(f"Skipping segment {i} '{segment.get('title', 'Unknown')}': invalid document_id '{document_id}' (LLM-generated placeholder, not a real document)")
                    continue

                # Get source video path - try query method for better compatibility
                doc = db.session.query(Document).filter(Document.id == doc_uuid).first()
                if not doc:
                    logger.warning(f"Skipping segment {i}: document not found (UUID: {doc_uuid})")
                    # Log available documents for debugging (only once)
                    if i == 0:
                        all_docs = db.session.query(Document).filter(Document.file_type == 'youtube').limit(10).all()
                        logger.info(f"Available YouTube documents (first 10): {[(str(d.id), d.original_filename) for d in all_docs]}")
                    continue

                # Handle YouTube videos
                if doc.file_type == 'youtube':
                    # Check if video file is already downloaded
                    if doc.file_path and os.path.exists(os.path.join(settings.UPLOAD_FOLDER, doc.file_path)):
                        # Check if it's a video file (not audio)
                        file_ext = os.path.splitext(doc.file_path)[1].lower()
                        if file_ext in ['.mp4', '.webm', '.mkv', '.avi']:
                            source_path = os.path.join(settings.UPLOAD_FOLDER, doc.file_path)
                        else:
                            # Audio file exists, need to download video
                            logger.info(f"YouTube video not cached, downloading: {doc.youtube_url}")
                            from app.services.youtube import YouTubeService
                            yt_service = YouTubeService()
                            try:
                                video_info = yt_service.download_video(doc.youtube_url)
                                source_path = video_info['file_path']
                                # Update document with video file path for future use
                                doc.file_path = os.path.relpath(source_path, settings.UPLOAD_FOLDER)
                                db.session.commit()
                            except Exception as e:
                                logger.error(f"Failed to download YouTube video {doc.youtube_url}: {e}")
                                continue
                    else:
                        # No file cached, download video
                        logger.info(f"Downloading YouTube video: {doc.youtube_url}")
                        from app.services.youtube import YouTubeService
                        yt_service = YouTubeService()
                        try:
                            video_info = yt_service.download_video(doc.youtube_url)
                            source_path = video_info['file_path']
                            # Update document with video file path
                            doc.file_path = os.path.relpath(source_path, settings.UPLOAD_FOLDER)
                            db.session.commit()
                        except Exception as e:
                            logger.error(f"Failed to download YouTube video {doc.youtube_url}: {e}")
                            continue
                else:
                    # Regular video file
                    if not doc.file_path:
                        logger.warning(f"Skipping segment {i}: no file path for document")
                        continue
                    source_path = os.path.join(settings.UPLOAD_FOLDER, doc.file_path)

                if not os.path.exists(source_path):
                    logger.warning(f"Skipping segment {i}: source file not found at {source_path}")
                    continue

                # Add title card if enabled
                if project.title_cards_enabled and segment.get('title_card', {}).get('enabled'):
                    title_card_path = os.path.join(temp_dir, f'title_{i}.mp4')
                    title_text = segment['title_card'].get('text', segment.get('title', 'Chapter'))
                    title_duration = segment['title_card'].get('duration', 3.0)

                    logger.info(f"Creating title card {i}: {title_text}")
                    if ffmpeg.create_title_card(
                        text=title_text,
                        output_path=title_card_path,
                        duration=title_duration,
                        resolution=project.resolution
                    ):
                        segment_files.append(title_card_path)
                    else:
                        logger.warning(f"Failed to create title card {i}, skipping")

                # Extract video segment
                segment_path = os.path.join(temp_dir, f'segment_{i}.mp4')
                logger.info(f"Extracting segment {i}: {segment['start_time']:.1f}s - {segment['end_time']:.1f}s from {doc.original_filename}")

                success = ffmpeg.extract_segment(
                    input_path=source_path,
                    output_path=segment_path,
                    start_time=segment['start_time'],
                    end_time=segment['end_time'],
                    resolution=project.resolution
                )

                if success:
                    segment_files.append(segment_path)
                else:
                    logger.error(f"Failed to extract segment {i}")

            if not segment_files:
                raise Exception("No segments were successfully extracted")

            logger.info(f"Successfully extracted {len(segment_files)} clips")

            # Step 2: Concatenate
            logger.info("Concatenating segments...")
            self.update_state(state='PROGRESS', meta={'progress': 75})
            job.progress_percentage = 75
            db.session.commit()

            output_filename = f"videomix_{project.id}_{render_job_id}.mp4"
            output_path = os.path.join(output_dir, output_filename)

            success = ffmpeg.concatenate_videos(
                input_files=segment_files,
                output_path=output_path,
                normalize_audio=project.audio_normalization
            )

            if not success:
                raise Exception("Video concatenation failed")

            # Step 3: Finalize
            logger.info("Render complete, finalizing...")
            self.update_state(state='PROGRESS', meta={'progress': 95})
            job.progress_percentage = 95
            db.session.commit()

            # Get output file size
            output_size = os.path.getsize(output_path)

            job.status = RenderJobStatusEnum.completed
            job.progress_percentage = 100
            job.output_filename = output_filename
            job.output_size_bytes = output_size
            job.completed_at = datetime.utcnow()

            project.status = VideoMixStatusEnum.completed

            db.session.commit()

            # Step 4: Cleanup temp files
            logger.info("Cleaning up temporary files...")
            cleanup_count = 0
            for file in segment_files:
                try:
                    if os.path.exists(file):
                        os.remove(file)
                        cleanup_count += 1
                except Exception as e:
                    logger.warning(f"Failed to cleanup {file}: {e}")

            try:
                if temp_dir and os.path.exists(temp_dir):
                    os.rmdir(temp_dir)
                    logger.info(f"Removed temp directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Failed to remove temp directory: {e}")

            logger.info(f"Render completed: {output_filename} ({output_size / (1024**2):.2f} MB), cleaned up {cleanup_count} temp files")
            return f"Success: {output_filename}"

        except Exception as e:
            logger.exception(f"Error rendering video mix: {e}")

            if job:
                job.status = RenderJobStatusEnum.error
                job.error_message = str(e)

            if project:
                project.status = VideoMixStatusEnum.error
                project.error_message = str(e)

            db.session.commit()

            # Cleanup on error
            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir)
                    logger.info(f"Cleaned up temp directory after error: {temp_dir}")
                except Exception as cleanup_err:
                    logger.warning(f"Failed to cleanup temp directory after error: {cleanup_err}")

            raise e

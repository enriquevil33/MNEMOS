import logging
from flask import Blueprint, request, jsonify, send_from_directory
from app.models.videomix import VideoMixProject, VideoMixScript, VideoMixRenderJob
from app.services.videomix_script_generator import VideoMixScriptGenerator
from app.extensions import db
from config.settings import settings
import os
from uuid import UUID

logger = logging.getLogger(__name__)

bp = Blueprint('videomix', __name__, url_prefix='/api/videomix')


@bp.route('/projects', methods=['GET'])
def list_projects():
    """List all video mix projects."""
    try:
        projects = db.session.query(VideoMixProject).order_by(
            VideoMixProject.created_at.desc()
        ).all()

        return jsonify([p.to_dict() for p in projects])

    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/projects', methods=['POST'])
def create_project():
    """Create a new video mix project."""
    data = request.get_json()

    if not data.get('title') or not data.get('user_prompt') or not data.get('document_ids'):
        return jsonify({"error": "Missing required fields: title, user_prompt, document_ids"}), 400

    try:
        project = VideoMixProject(
            title=data['title'],
            description=data.get('description'),
            user_prompt=data['user_prompt'],
            document_ids=data['document_ids'],
            resolution=data.get('resolution', '1080p'),
            title_cards_enabled=data.get('title_cards_enabled', False),
            max_duration_seconds=data.get('max_duration_seconds'),
            audio_normalization=data.get('audio_normalization', True)
        )

        db.session.add(project)
        db.session.commit()

        logger.info(f"Created video mix project: {project.id}")
        return jsonify(project.to_dict()), 201

    except Exception as e:
        logger.error(f"Error creating project: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/projects/<string:project_id>', methods=['GET'])
def get_project(project_id):
    """Get project details with all scripts and render jobs."""
    try:
        project = db.session.get(VideoMixProject, UUID(project_id))

        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = project.to_dict()
        data['scripts'] = [s.to_dict() for s in project.scripts]
        data['render_jobs'] = [j.to_dict() for j in project.render_jobs]

        return jsonify(data)

    except ValueError:
        return jsonify({"error": "Invalid project ID format"}), 400
    except Exception as e:
        logger.error(f"Error getting project: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/projects/<string:project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project settings."""
    try:
        project = db.session.get(VideoMixProject, UUID(project_id))

        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = request.get_json()

        # Update fields if provided
        if 'title' in data:
            project.title = data['title']
        if 'description' in data:
            project.description = data['description']
        if 'resolution' in data:
            project.resolution = data['resolution']
        if 'title_cards_enabled' in data:
            project.title_cards_enabled = data['title_cards_enabled']
        if 'max_duration_seconds' in data:
            project.max_duration_seconds = data['max_duration_seconds']
        if 'audio_normalization' in data:
            project.audio_normalization = data['audio_normalization']

        db.session.commit()
        return jsonify(project.to_dict())

    except ValueError:
        return jsonify({"error": "Invalid project ID format"}), 400
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/projects/<string:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete project and all associated data."""
    try:
        project = db.session.get(VideoMixProject, UUID(project_id))

        if not project:
            return jsonify({"error": "Project not found"}), 404

        # Delete output files
        output_dir = os.path.join(settings.UPLOAD_FOLDER, 'videomix_output')
        for job in project.render_jobs:
            if job.output_filename:
                output_path = os.path.join(output_dir, job.output_filename)
                if os.path.exists(output_path):
                    try:
                        os.remove(output_path)
                        logger.info(f"Deleted output file: {job.output_filename}")
                    except Exception as e:
                        logger.warning(f"Failed to delete output file: {e}")

        db.session.delete(project)
        db.session.commit()

        logger.info(f"Deleted project: {project_id}")
        return jsonify({"message": "Project deleted successfully"}), 200

    except ValueError:
        return jsonify({"error": "Invalid project ID format"}), 400
    except Exception as e:
        logger.error(f"Error deleting project: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/projects/<string:project_id>/generate-script', methods=['POST'])
def generate_script(project_id):
    """Generate script for project using LLM."""
    try:
        project = db.session.get(VideoMixProject, UUID(project_id))

        if not project:
            return jsonify({"error": "Project not found"}), 404

        # Update status
        from app.models.videomix import VideoMixStatusEnum
        project.status = VideoMixStatusEnum.generating_script
        db.session.commit()

        # Generate script
        generator = VideoMixScriptGenerator(db.session)
        script_data = generator.generate_script(
            user_prompt=project.user_prompt,
            document_ids=project.document_ids,
            max_duration=project.max_duration_seconds,
            iterations=3
        )

        # Get next version number
        latest_version = 0
        if project.scripts:
            latest_version = max(s.version for s in project.scripts)

        # Save script
        script = VideoMixScript(
            project_id=project.id,
            version=latest_version + 1,
            script_data=script_data,
            total_duration=script_data.get('total_duration', 0),
            segment_count=script_data.get('segment_count', 0),
            llm_reasoning=script_data.get('llm_reasoning', '')
        )

        db.session.add(script)
        project.status = VideoMixStatusEnum.script_ready
        db.session.commit()

        logger.info(f"Generated script version {script.version} for project {project_id}")
        return jsonify(script.to_dict()), 201

    except ValueError:
        return jsonify({"error": "Invalid project ID format"}), 400
    except Exception as e:
        logger.error(f"Error generating script: {e}")
        from app.models.videomix import VideoMixStatusEnum
        if 'project' in locals():
            project.status = VideoMixStatusEnum.error
            project.error_message = str(e)
            db.session.commit()
        return jsonify({"error": str(e)}), 500


@bp.route('/projects/<string:project_id>/refine-script', methods=['POST'])
def refine_script(project_id):
    """Refine script based on user feedback (chat message)."""
    try:
        project = db.session.get(VideoMixProject, UUID(project_id))

        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = request.get_json()
        user_message = data.get('message')

        if not user_message:
            return jsonify({"error": "Message required"}), 400

        # Get latest script
        if not project.scripts:
            return jsonify({"error": "No script to refine. Please generate a script first."}), 400

        latest_script = project.scripts[0]

        # Combine original prompt with user feedback
        combined_prompt = f"{project.user_prompt}\n\nUser feedback: {user_message}"

        # Regenerate with updated prompt
        generator = VideoMixScriptGenerator(db.session)
        script_data = generator.generate_script(
            user_prompt=combined_prompt,
            document_ids=project.document_ids,
            max_duration=project.max_duration_seconds,
            iterations=2  # Fewer iterations for refinement
        )

        # Save new version
        script = VideoMixScript(
            project_id=project.id,
            version=latest_script.version + 1,
            script_data=script_data,
            total_duration=script_data.get('total_duration', 0),
            segment_count=script_data.get('segment_count', 0),
            llm_reasoning=script_data.get('llm_reasoning', '')
        )

        db.session.add(script)
        db.session.commit()

        logger.info(f"Refined script to version {script.version} for project {project_id}")
        return jsonify(script.to_dict()), 201

    except ValueError:
        return jsonify({"error": "Invalid project ID format"}), 400
    except Exception as e:
        logger.error(f"Error refining script: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/scripts/<string:script_id>/render', methods=['POST'])
def render_script(script_id):
    """Start rendering a script (placeholder - will be implemented in Phase 4)."""
    try:
        script = db.session.get(VideoMixScript, UUID(script_id))

        if not script:
            return jsonify({"error": "Script not found"}), 404

        # Create render job
        from app.models.videomix import RenderJobStatusEnum
        job = VideoMixRenderJob(
            project_id=script.project_id,
            script_id=script.id,
            status=RenderJobStatusEnum.pending
        )

        db.session.add(job)

        from app.models.videomix import VideoMixStatusEnum
        script.project.status = VideoMixStatusEnum.rendering
        db.session.commit()

        # TODO: Start Celery task in Phase 4
        # task = render_videomix_task.delay(str(job.id))
        # job.celery_task_id = task.id
        # db.session.commit()

        # Start Celery task
        from app.tasks.videomix_tasks import render_videomix_task
        task = render_videomix_task.delay(str(job.id))
        job.celery_task_id = task.id
        db.session.commit()

        logger.info(f"Started render job: {job.id} (task: {task.id})")
        return jsonify(job.to_dict()), 202

    except ValueError:
        return jsonify({"error": "Invalid script ID format"}), 400
    except Exception as e:
        logger.error(f"Error starting render: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/render-jobs/<string:job_id>', methods=['GET'])
def get_render_job(job_id):
    """Get render job status."""
    try:
        job = db.session.get(VideoMixRenderJob, UUID(job_id))

        if not job:
            return jsonify({"error": "Render job not found"}), 404


        # Check Celery task status for progress updates
        from app.models.videomix import RenderJobStatusEnum
        if job.status == RenderJobStatusEnum.processing and job.celery_task_id:
            from celery.result import AsyncResult
            from app.extensions import celery_app
            task = AsyncResult(job.celery_task_id, app=celery_app)

            if task.state == 'PROGRESS':
                meta = task.info
                job.progress_percentage = meta.get('progress', job.progress_percentage)
                db.session.commit()

        return jsonify(job.to_dict())

    except ValueError:
        return jsonify({"error": "Invalid job ID format"}), 400
    except Exception as e:
        logger.error(f"Error getting render job: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route('/render-jobs/<string:job_id>/cancel', methods=['POST'])
def cancel_render_job(job_id):
    """Cancel a running render job."""
    try:
        job = db.session.get(VideoMixRenderJob, UUID(job_id))

        if not job:
            return jsonify({"error": "Render job not found"}), 404

        from app.models.videomix import RenderJobStatusEnum, VideoMixStatusEnum

        # Only cancel if job is pending or processing
        if job.status not in [RenderJobStatusEnum.pending, RenderJobStatusEnum.processing]:
            return jsonify({"error": "Job is not active"}), 400

        # Revoke the Celery task
        if job.celery_task_id:
            from celery.result import AsyncResult
            from app.extensions import celery_app
            task = AsyncResult(job.celery_task_id, app=celery_app)
            task.revoke(terminate=True)
            logger.info(f"Revoked Celery task: {job.celery_task_id}")

        # Update job status
        job.status = RenderJobStatusEnum.error
        job.error_message = "Canceled by user"

        # Update project status
        project = db.session.get(VideoMixProject, job.project_id)
        if project:
            project.status = VideoMixStatusEnum.script_ready
            project.error_message = None

        db.session.commit()

        logger.info(f"Canceled render job: {job_id}")
        return jsonify({"message": "Render job canceled"}), 200

    except ValueError:
        return jsonify({"error": "Invalid job ID format"}), 400
    except Exception as e:
        logger.error(f"Error canceling render job: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/render-jobs/<string:job_id>/download', methods=['GET'])
def download_render(job_id):
    """Download rendered video."""
    try:
        job = db.session.get(VideoMixRenderJob, UUID(job_id))

        if not job or not job.output_filename:
            return jsonify({"error": "Render not found"}), 404

        from app.models.videomix import RenderJobStatusEnum
        if job.status != RenderJobStatusEnum.completed:
            return jsonify({"error": "Render not completed yet"}), 400

        output_dir = os.path.join(settings.UPLOAD_FOLDER, 'videomix_output')

        if not os.path.exists(os.path.join(output_dir, job.output_filename)):
            return jsonify({"error": "Output file not found"}), 404

        return send_from_directory(
            output_dir,
            job.output_filename,
            as_attachment=True
        )

    except ValueError:
        return jsonify({"error": "Invalid job ID format"}), 400
    except Exception as e:
        logger.error(f"Error downloading render: {e}")
        return jsonify({"error": str(e)}), 500

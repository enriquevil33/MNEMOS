"""
Archive utility for storing uploaded files in persistent folders
"""
import os
import shutil
from config.settings import settings
from app.models.user_preferences import UserPreferences
from app.extensions import db

def get_archive_folder_for_type(file_type: str) -> str:
    """
    Get the archive folder path for a specific file type.

    Args:
        file_type: One of 'pdf', 'epub', 'audio', 'video', 'youtube'

    Returns:
        Full path to the archive folder for this type
    """
    folder_map = {
        'pdf': 'pdf',
        'epub': 'epub',
        'audio': 'audio',
        'video': 'video',
        'youtube': 'youtube'
    }

    subfolder = folder_map.get(file_type, 'other')
    archive_path = os.path.join(settings.ARCHIVE_FOLDER, subfolder)

    # Create folder if it doesn't exist
    os.makedirs(archive_path, exist_ok=True)

    return archive_path

def is_archive_enabled() -> bool:
    """
    Check if archive is enabled in user preferences.

    Returns:
        True if archive is enabled, False otherwise
    """
    try:
        prefs = db.session.query(UserPreferences).first()
        return prefs.archive_enabled if prefs else False
    except Exception:
        return False

def archive_file(source_path: str, filename: str, file_type: str) -> bool:
    """
    Copy a file to the archive folder if archiving is enabled.

    Args:
        source_path: Full path to the source file
        filename: Name of the file to archive
        file_type: Type of file (pdf, epub, audio, video, youtube)

    Returns:
        True if file was archived successfully, False otherwise
    """
    if not is_archive_enabled():
        return False

    if not os.path.exists(source_path):
        return False

    try:
        archive_folder = get_archive_folder_for_type(file_type)
        destination_path = os.path.join(archive_folder, filename)

        # Copy file to archive
        shutil.copy2(source_path, destination_path)
        return True
    except Exception as e:
        print(f"Failed to archive file {filename}: {e}")
        return False

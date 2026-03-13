import subprocess
import os
import logging
from typing import List

logger = logging.getLogger(__name__)


class FFmpegService:
    """
    Wrapper for FFmpeg operations with predefined templates.
    All operations are safe and validated - no dynamic command generation.
    """

    @staticmethod
    def extract_segment(
        input_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        resolution: str = 'source'
    ) -> bool:
        """
        Extract a video segment with optional resolution scaling.

        Args:
            input_path: Full path to source video
            output_path: Full path for output segment
            start_time: Start time in seconds
            end_time: End time in seconds
            resolution: '1080p', '720p', '480p', or 'source'

        Returns:
            True if successful, False otherwise
        """
        try:
            duration = end_time - start_time

            if duration <= 0:
                logger.error(f"Invalid duration: {duration} seconds")
                return False

            # Build FFmpeg command
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output
                '-ss', str(start_time),
                '-i', input_path,
                '-t', str(duration),
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k'
            ]

            # Add scaling if needed
            if resolution != 'source':
                scale_map = {
                    '1080p': 'scale=-2:1080',
                    '720p': 'scale=-2:720',
                    '480p': 'scale=-2:480'
                }
                if resolution in scale_map:
                    cmd.extend(['-vf', scale_map[resolution]])
                else:
                    logger.warning(f"Unknown resolution '{resolution}', using source")

            cmd.append(output_path)

            logger.info(f"Extracting segment: {start_time:.1f}s-{end_time:.1f}s from {os.path.basename(input_path)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode == 0:
                logger.info(f"Segment extracted successfully: {os.path.basename(output_path)}")
                return True
            else:
                logger.error(f"FFmpeg extraction failed: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"FFmpeg extraction timed out after 300s")
            return False
        except Exception as e:
            logger.error(f"Error extracting segment: {e}")
            return False

    @staticmethod
    def create_title_card(
        text: str,
        output_path: str,
        duration: float = 3.0,
        resolution: str = '1080p'
    ) -> bool:
        """
        Generate a title card video with text overlay.

        Args:
            text: Text to display
            output_path: Output file path
            duration: Duration in seconds
            resolution: '1080p', '720p', '480p'

        Returns:
            True if successful, False otherwise
        """
        try:
            size_map = {
                '1080p': '1920x1080',
                '720p': '1280x720',
                '480p': '854x480'
            }
            size = size_map.get(resolution, '1920x1080')

            # Escape text for FFmpeg drawtext filter
            # Replace single quotes and colons which are special in drawtext
            safe_text = text.replace("'", "'\\''").replace(":", r'\:')

            cmd = [
                'ffmpeg',
                '-y',
                '-f', 'lavfi',
                '-i', f'color=c=black:s={size}:d={duration}',
                '-vf', f"drawtext=text='{safe_text}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2",
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                output_path
            ]

            logger.info(f"Creating title card: {text[:50]}...")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            if result.returncode == 0:
                logger.info(f"Title card created: {os.path.basename(output_path)}")
                return True
            else:
                logger.error(f"Title card creation failed: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"Title card creation timed out after 60s")
            return False
        except Exception as e:
            logger.error(f"Error creating title card: {e}")
            return False

    @staticmethod
    def concatenate_videos(
        input_files: List[str],
        output_path: str,
        normalize_audio: bool = True
    ) -> bool:
        """
        Concatenate multiple video files with optional audio normalization.

        Args:
            input_files: List of input video file paths
            output_path: Output file path
            normalize_audio: Apply loudnorm filter for consistent volume

        Returns:
            True if successful, False otherwise
        """
        try:
            if not input_files:
                logger.error("No input files provided for concatenation")
                return False

            # Create concat file
            concat_file = output_path + '.concat.txt'
            with open(concat_file, 'w', encoding='utf-8') as f:
                for file_path in input_files:
                    # Escape paths for FFmpeg concat
                    safe_path = file_path.replace("'", "'\\''")
                    f.write(f"file '{safe_path}'\n")

            cmd = [
                'ffmpeg',
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_file,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23'
            ]

            # Audio normalization using EBU R128 standard
            if normalize_audio:
                cmd.extend([
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-c:a', 'aac',
                    '-b:a', '192k'
                ])
            else:
                cmd.extend(['-c:a', 'aac', '-b:a', '192k'])

            cmd.append(output_path)

            logger.info(f"Concatenating {len(input_files)} videos (normalize_audio={normalize_audio})")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)

            # Clean up concat file
            try:
                os.remove(concat_file)
            except Exception as cleanup_err:
                logger.warning(f"Failed to cleanup concat file: {cleanup_err}")

            if result.returncode == 0:
                logger.info(f"Videos concatenated successfully: {os.path.basename(output_path)}")
                return True
            else:
                logger.error(f"Concatenation failed: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"Concatenation timed out after 3600s")
            return False
        except Exception as e:
            logger.error(f"Error concatenating videos: {e}")
            return False

    @staticmethod
    def get_video_duration(file_path: str) -> float:
        """
        Get duration of video file in seconds using ffprobe.

        Args:
            file_path: Path to video file

        Returns:
            Duration in seconds, or 0.0 if failed
        """
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                file_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                return float(result.stdout.strip())
            else:
                logger.error(f"ffprobe failed: {result.stderr}")
                return 0.0

        except subprocess.TimeoutExpired:
            logger.error(f"ffprobe timed out after 30s")
            return 0.0
        except ValueError:
            logger.error(f"Could not parse duration from ffprobe output")
            return 0.0
        except Exception as e:
            logger.error(f"Error getting video duration: {e}")
            return 0.0

    @staticmethod
    def check_ffmpeg_available() -> bool:
        """
        Check if FFmpeg is available in the system.

        Returns:
            True if FFmpeg is available, False otherwise
        """
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False

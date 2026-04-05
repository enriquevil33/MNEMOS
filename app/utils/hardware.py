"""
Hardware detection and optimization utilities.
Auto-detects GPU capabilities and recommends optimal batch sizes.
"""
import torch
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class HardwareDetector:
    """Detects available hardware and recommends optimal settings."""

    _cache: Optional[Dict] = None

    @classmethod
    def get_device_info(cls) -> Dict:
        """
        Detect available hardware and return device information.
        Results are cached for performance.

        Returns:
            dict: {
                'device': 'cuda' | 'mps' | 'cpu',
                'device_name': str,
                'vram_gb': float (GPU only),
                'recommended_batch_size': int,
                'supports_fp16': bool
            }
        """
        if cls._cache is not None:
            return cls._cache

        info = {
            'device': 'cpu',
            'device_name': 'CPU',
            'vram_gb': 0,
            'recommended_batch_size': 16,  # Safe default for CPU
            'supports_fp16': False
        }

        try:
            # Check CUDA (NVIDIA GPU)
            if torch.cuda.is_available():
                info['device'] = 'cuda'
                info['device_name'] = torch.cuda.get_device_name(0)
                info['supports_fp16'] = True

                # Get VRAM in GB
                vram_bytes = torch.cuda.get_device_properties(0).total_memory
                info['vram_gb'] = vram_bytes / (1024 ** 3)

                # Recommend batch size based on VRAM
                # Conservative estimates to avoid OOM
                if info['vram_gb'] >= 16:
                    info['recommended_batch_size'] = 128
                elif info['vram_gb'] >= 8:
                    info['recommended_batch_size'] = 64
                elif info['vram_gb'] >= 4:
                    info['recommended_batch_size'] = 32
                else:
                    info['recommended_batch_size'] = 16

                logger.info(f"GPU detected: {info['device_name']} with {info['vram_gb']:.1f}GB VRAM")

            # Check MPS (Apple Silicon)
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                info['device'] = 'mps'
                info['device_name'] = 'Apple Silicon (MPS)'
                info['recommended_batch_size'] = 32
                info['supports_fp16'] = True
                logger.info("Apple Silicon GPU detected (MPS)")

            else:
                logger.info("No GPU detected, using CPU")

        except Exception as e:
            logger.warning(f"Error detecting hardware: {e}. Falling back to CPU.")

        cls._cache = info
        return info

    @classmethod
    def get_optimal_batch_size(cls, override: Optional[int] = None) -> int:
        """
        Get optimal batch size for embeddings.

        Args:
            override: Manual override value (takes precedence)

        Returns:
            int: Recommended batch size
        """
        if override is not None and override > 0:
            logger.info(f"Using manual batch size override: {override}")
            return override

        info = cls.get_device_info()
        batch_size = info['recommended_batch_size']
        logger.info(f"Using auto-detected batch size: {batch_size} for {info['device']}")
        return batch_size

    @classmethod
    def get_device(cls) -> str:
        """Get the device to use for torch operations."""
        return cls.get_device_info()['device']

    @classmethod
    def supports_fp16(cls) -> bool:
        """Check if hardware supports FP16 (mixed precision)."""
        return cls.get_device_info()['supports_fp16']

    @classmethod
    def resolve_device(cls, requested_device: str) -> str:
        """
        Resolve a device request to an actual available device.

        Handles 'auto' mode and validates explicitly requested devices.
        Falls back to CPU if requested device is unavailable.

        Args:
            requested_device: Device string ('auto', 'cuda', 'mps', 'cpu')

        Returns:
            str: Actual device to use ('cuda', 'mps', or 'cpu')
        """
        # Auto mode - use detected device
        if requested_device == "auto":
            device = cls.get_device()
            logger.info(f"Device auto-detection selected: {device}")
            return device

        # Explicit device request - validate availability
        info = cls.get_device_info()
        available_device = info['device']

        # Check if requested device matches available device
        if requested_device == available_device:
            logger.info(f"Using requested device: {requested_device}")
            return requested_device

        # Requested device not available - check specific cases
        if requested_device == "cuda":
            if not torch.cuda.is_available():
                logger.warning(
                    f"CUDA requested but not available "
                    f"(torch.cuda.is_available()=False). "
                    f"Falling back to {available_device}."
                )
                return available_device

        if requested_device == "mps":
            if not (hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()):
                logger.warning(
                    f"MPS requested but not available. "
                    f"Falling back to {available_device}."
                )
                return available_device

        # CPU is always available - if explicitly requested, use it
        if requested_device == "cpu":
            logger.info("Using CPU as requested (GPU available but not used)")
            return "cpu"

        # Unknown device or other edge case - fallback to available
        logger.warning(
            f"Unknown or unavailable device '{requested_device}' requested. "
            f"Falling back to {available_device}."
        )
        return available_device

    @classmethod
    def log_hardware_info(cls):
        """Log detailed hardware information."""
        info = cls.get_device_info()
        logger.info("=" * 60)
        logger.info("Hardware Configuration:")
        logger.info(f"  Device: {info['device']}")
        logger.info(f"  Name: {info['device_name']}")
        if info['vram_gb'] > 0:
            logger.info(f"  VRAM: {info['vram_gb']:.1f} GB")
        logger.info(f"  FP16 Support: {info['supports_fp16']}")
        logger.info(f"  Recommended Batch Size: {info['recommended_batch_size']}")
        logger.info("=" * 60)

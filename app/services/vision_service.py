import base64
import logging

logger = logging.getLogger(__name__)

DESCRIBE_PROMPT = (
    "You are analyzing a diagram, figure, or image extracted from a document. "
    "Describe its content in detail: what it shows, any labels, axes, data, relationships, "
    "or concepts depicted. Be precise and thorough so the description can stand alone as "
    "searchable text in a knowledge base."
)

# Model name substrings known to support vision. Checked case-insensitively.
_VISION_MODEL_PATTERNS = [
    "gpt-4o", "gpt-4-turbo", "gpt-4-vision",
    "claude-3", "claude-sonnet", "claude-opus", "claude-haiku",
    "gemini",
    "llava", "bakllava",
    "llama-3.2",
    "minicpm-v", "moondream",
    "deepseek-vl",
    "internvl", "qwen-vl", "cogvlm",
    "pixtral",
]


def model_supports_vision(model_name: str) -> bool:
    if not model_name:
        return False
    lower = model_name.lower()
    return any(pat in lower for pat in _VISION_MODEL_PATTERNS)


def _try_ocr(image_path: str) -> str | None:
    try:
        import pytesseract
        from PIL import Image
        text = pytesseract.image_to_string(Image.open(image_path)).strip()
        return text if text else None
    except ImportError:
        return None
    except Exception as e:
        logger.debug(f"OCR fallback failed for {image_path}: {e}")
        return None


class VisionService:
    """
    Describes images/diagrams using a vision LLM with OCR fallback.

    Fallback chain (stops at first success):
      1. Vision LLM  — rich semantic description
      2. OCR         — pytesseract text extraction (requires: pip install pytesseract pillow)
      3. None        — chunk is skipped entirely
    """

    def describe_image(self, image_path: str, page_number: int = None, model: str = None) -> str | None:
        """
        Returns a textual description of the image, or None if all fallbacks fail.
        """
        from config.settings import settings
        if not getattr(settings, 'VISION_ENABLED', False):
            return None

        description = self._describe_via_llm(image_path, page_number, model, settings)
        if description:
            return description

        logger.debug(f"Vision LLM unavailable or failed for {image_path}, trying OCR fallback.")
        ocr_text = _try_ocr(image_path)
        if ocr_text:
            prefix = f"[Image text on page {page_number}]" if page_number else "[Image text]"
            return f"{prefix} {ocr_text}"

        logger.debug(f"All description methods failed for {image_path}, skipping chunk.")
        return None

    def _describe_via_llm(
        self, image_path: str, page_number: int | None, model: str | None, settings
    ) -> str | None:
        try:
            from app.services.llm_client import get_llm_client
            from app.services.model_manager import model_manager

            llm = get_llm_client()

            vision_model = model or getattr(settings, 'VISION_MODEL', None) or None
            effective_model = vision_model or model_manager.get_model() or llm.model

            skip_unknown = getattr(settings, 'VISION_SKIP_UNKNOWN_MODELS', True)
            if skip_unknown and not model_supports_vision(effective_model):
                logger.debug(
                    f"Model '{effective_model}' not in vision allowlist. "
                    "Set VISION_MODEL to a known vision model, or VISION_SKIP_UNKNOWN_MODELS=false to force."
                )
                return None

            with open(image_path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode('utf-8')

            page_note = f" (extracted from page {page_number})" if page_number else ""
            description = llm.chat(
                system=DESCRIBE_PROMPT,
                messages=[{"role": "user", "content": f"Describe this diagram or image{page_note}."}],
                images=[b64],
                model=vision_model,
            )
            return description.strip() if description else None

        except Exception as e:
            logger.warning(f"Vision LLM failed for {image_path}: {e}")
            return None

import fitz  # PyMuPDF
import os
from typing import List, Dict

# Minimum pixel area to consider an image worth extracting — skips tiny icons/decorations.
_MIN_PX_AREA = 100 * 100  # 10 000 px²


class PDFProcessor:
    def extract_text(self, file_path: str) -> tuple[List[Dict], Dict]:
        with fitz.open(file_path) as doc:
            pages = []
            metadata = {}
            if doc.metadata:
                for key in ['title', 'author', 'subject', 'keywords']:
                    if doc.metadata.get(key):
                        metadata[key] = doc.metadata[key]

            for i, page in enumerate(doc):
                text = page.get_text()
                if text.strip():
                    pages.append({"text": text.strip(), "page": i + 1})

        return pages, metadata

    def extract_images(self, file_path: str, output_dir: str) -> List[Dict]:
        """
        Extract images from PDF and save to output_dir.
        Returns: [{"image_path": str, "page": int}, ...]
        Deduplicates by xref and skips images below _MIN_PX_AREA without decoding them.
        """
        os.makedirs(output_dir, exist_ok=True)
        results = []
        seen_xrefs: set[int] = set()

        with fitz.open(file_path) as doc:
            for page_num, page in enumerate(doc, start=1):
                # img_ref tuple: (xref, smask, width, height, bpc, colorspace, ...)
                for img_index, img_ref in enumerate(page.get_images(full=True)):
                    xref = img_ref[0]
                    if xref in seen_xrefs:
                        continue
                    seen_xrefs.add(xref)

                    width, height = img_ref[2], img_ref[3]
                    if width * height < _MIN_PX_AREA:
                        continue

                    try:
                        img_data = doc.extract_image(xref)
                        ext = img_data.get("ext", "png")
                        dest = os.path.join(output_dir, f"page_{page_num}_img_{img_index}.{ext}")
                        with open(dest, "wb") as f:
                            f.write(img_data["image"])
                        results.append({"image_path": dest, "page": page_num})
                    except Exception:
                        continue

        return results

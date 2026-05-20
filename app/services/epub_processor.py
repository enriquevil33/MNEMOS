import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)

class EpubProcessor:
    def process(self, file_path: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Extract text and metadata from EPUB.
        Returns:
            (
                [{"text": "...", "page": section_index}],
                {"title": "...", "author": "...", ...}
            )
        """
        try:
            book = epub.read_epub(file_path)
            
            # Extract Metadata
            metadata = self._extract_metadata(book)
            
            # Extract Text
            pages = []
            
            # Iterate through items
            # In EPUB, "pages" are vague. We'll use document items (chapters) as units.
            # We filter for only the document/html items.
            items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))

            # Fallback: some EPUBs store pages in subdirectories that ebooklib misses,
            # or only registers one item (e.g. notice.html) instead of all page files.
            # Read HTML files directly from the zip when ebooklib finds fewer than 3 items.
            if len(items) < 3:
                logger.warning("No ITEM_DOCUMENT items found, falling back to direct zip read.")
                import zipfile
                with zipfile.ZipFile(file_path) as zf:
                    html_names = sorted(
                        n for n in zf.namelist()
                        if n.endswith(('.html', '.htm', '.xhtml'))
                        and not n.lower().startswith('meta')
                    )
                    for i, name in enumerate(html_names):
                        content = zf.read(name)
                        soup = BeautifulSoup(content, 'html.parser')
                        for tag in soup(["script", "style"]):
                            tag.extract()
                        text = soup.get_text(separator=' ', strip=True)
                        if text:
                            pages.append({"text": text, "page": i + 1})
            else:
                for i, item in enumerate(items):
                    content = item.get_content()
                    soup = BeautifulSoup(content, 'html.parser')
                    for tag in soup(["script", "style"]):
                        tag.extract()
                    text = soup.get_text(separator=' ', strip=True)
                    if text:
                        pages.append({"text": text, "page": i + 1})
            
            return pages, metadata
            
        except Exception as e:
            logger.error(f"Error processing EPUB {file_path}: {e}")
            raise e

    def _extract_metadata(self, book) -> Dict[str, Any]:
        """Extract available metadata from the book object."""
        meta = {}
        
        # Helper to get first item safely
        def get_meta(namespace, name):
             data = book.get_metadata(namespace, name)
             if data:
                 return data[0][0]
             return None

        title = get_meta('DC', 'title')
        if title:
            meta['title'] = title
            
        creator = get_meta('DC', 'creator')
        if creator:
            meta['author'] = creator
            
        description = get_meta('DC', 'description')
        if description:
            meta['description'] = description
            
        language = get_meta('DC', 'language')
        if language:
            meta['language'] = language
            
        return meta

import katex from 'katex';

/**
 * Renders KaTeX math in an already-mounted DOM element.
 * Replaces $$...$$ (display) and $...$ (inline) with rendered HTML in-place.
 * Safe to call repeatedly — already-rendered KaTeX spans are not double-processed
 * because they no longer contain raw $ delimiters.
 */
export function renderKatexInElement(root: HTMLElement): void {
  // Walk only text-bearing children, skip anything already rendered by KaTeX
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const node of textNodes) {
    const raw = node.textContent ?? '';
    if (!raw.includes('$')) continue;

    // Replace display math first, then inline
    let html = raw.replace(/\$\$([^\$]+)\$\$/g, (_m, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return _m; }
    });

    html = html.replace(/\$([^\$\n]+)\$/g, (_m, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return _m; }
    });

    // Only touch the DOM if something changed
    if (html !== raw) {
      const span = document.createElement('span');
      span.innerHTML = html;
      node.parentNode?.replaceChild(span, node);
    }
  }
}

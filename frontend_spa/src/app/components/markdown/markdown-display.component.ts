import { Component, input, effect, signal, inject, ViewEncapsulation, output, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { marked } from 'marked';
import katex from 'katex';

@Component({
  selector: 'app-markdown-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="markdown-content" [innerHTML]="sanitizedContent()" (click)="handleContentClick($event)"></div>
  `,
  styles: [`
    .markdown-content {
      font-size: 0.95rem;
      line-height: 1.6;
      color: inherit;
    }

    /* Headers */
    .markdown-content h1, 
    .markdown-content h2, 
    .markdown-content h3, 
    .markdown-content h4 {
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.75em;
      color: inherit;
    }
    .markdown-content h1 { font-size: 1.5em; }
    .markdown-content h2 { font-size: 1.25em; }
    .markdown-content h3 { font-size: 1.1em; }

    /* Paragraphs */
    .markdown-content p {
      margin-bottom: 1em;
    }
    .markdown-content p:last-child {
      margin-bottom: 0;
    }

    /* Links */
    .markdown-content a {
      color: var(--color-accent);
      text-decoration: underline;
    }

    /* Lists */
    .markdown-content ul, 
    .markdown-content ol {
      padding-left: 1.5em;
      margin-bottom: 1em;
    }
    .markdown-content ul { list-style-type: disc; }
    .markdown-content ol { list-style-type: decimal; }

    /* Code Blocks */
    .markdown-content pre {
      background-color: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--color-divider);
      border-radius: 0.5rem;
      padding: 1em;
      overflow-x: auto;
      margin-bottom: 1em;
      font-family: var(--font-mono);
    }
    .markdown-content code {
      background-color: rgba(255, 255, 255, 0.1);
      padding: 0.2em 0.4em;
      border-radius: 0.25rem;
      font-size: 0.85em;
      font-family: var(--font-mono);
    }
    .markdown-content pre code {
      background-color: transparent;
      padding: 0;
      font-size: 0.9em;
      color: inherit;
    }

    /* Tables */
    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
      display: block;
      overflow-x: auto;
    }
    .markdown-content th,
    .markdown-content td {
      padding: 0.75em 1em;
      border: 1px solid var(--color-divider);
      text-align: left;
    }
    .markdown-content th {
      background-color: rgba(0, 0, 0, 0.1);
      font-weight: 600;
    }
    .markdown-content tr:nth-child(even) {
      background-color: rgba(255, 255, 255, 0.02);
    }

    /* Blockquotes */
    .markdown-content blockquote {
      border-left: 4px solid var(--color-accent);
      padding-left: 1em;
      margin-left: 0;
      margin-bottom: 1em;
      font-style: italic;
      color: rgba(255, 255, 255, 0.7);
    }

    /* Citations (Custom) */
    .citation {
      color: var(--color-accent);
      cursor: pointer;
      font-weight: 500;
      text-decoration: underline;
      text-decoration-style: dotted;
      transition: all 0.2s;
    }
    .citation:hover {
      color: var(--color-accent-dark);
      background-color: var(--color-accent-subtle);
      border-radius: 4px;
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class MarkdownDisplayComponent implements AfterViewChecked {
  content = input.required<string>();
  citationClick = output<string>();
  sanitizer = inject(DomSanitizer);
  elementRef = inject(ElementRef);
  toastr = inject(ToastrService);

  sanitizedContent = signal<SafeHtml>('');
  private lastRenderedContent = '';

  constructor() {
    effect(async () => {
      const raw = this.content();
      if (!raw) {
        this.sanitizedContent.set('');
        return;
      }

      // Configure Marked with custom renderer for code blocks
      const renderer = new marked.Renderer();
      renderer.code = (obj: any) => {
        const codeStr = obj.text || '';
        const langStr = obj.lang || '';
        const isEscaped = obj.escaped || false;

        if (typeof codeStr !== 'string') return `<pre><code>${codeStr}</code></pre>`;

        const validLang = !!(langStr && langStr.match(/^[a-zA-Z0-9_-]+$/));
        const languageClass = validLang ? `language-${langStr}` : '';

        const escapedCode = isEscaped ? codeStr : codeStr
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        return `
          <div class="code-block-wrapper relative group mb-4">
            <pre style="margin-bottom:0;"><code class="${languageClass}">${escapedCode}</code></pre>
            <button class="copy-code-btn absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Copy code">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            </button>
          </div>
        `;
      };
      marked.use({ renderer });

      // Parse Markdown
      let html = await marked.parse(raw);

      // Process Citations: [Source: filename]
      // Regex matches [Source: anything] and wraps it
      html = html.replace(/\[Source:\s*([^\]]+)\]/g, (match, sourceName) => {
        return `<span class="citation" data-source="${sourceName.trim()}">${match}</span>`;
      });

      this.sanitizedContent.set(this.sanitizer.bypassSecurityTrustHtml(html));
      this.lastRenderedContent = raw;
    });
  }

  ngAfterViewChecked() {
    if (this.content() === this.lastRenderedContent) {
      this.renderMath();
    }
  }

  private renderMath() {
    const element = this.elementRef.nativeElement;
    const mathElements = element.querySelectorAll('.markdown-content');

    mathElements.forEach((el: HTMLElement) => {
      // Process inline math: $...$
      let html = el.innerHTML;

      // Replace display math $$...$$ first (to avoid conflicts with inline)
      html = html.replace(/\$\$([^\$]+)\$\$/g, (match, math) => {
        try {
          return katex.renderToString(math, { displayMode: true, throwOnError: false });
        } catch (e) {
          return match;
        }
      });

      // Replace inline math $...$
      html = html.replace(/\$([^\$]+)\$/g, (match, math) => {
        try {
          return katex.renderToString(math, { displayMode: false, throwOnError: false });
        } catch (e) {
          return match;
        }
      });

      el.innerHTML = html;
    });
  }

  handleContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Handle Citations
    const citation = target.closest('.citation');
    if (citation) {
      const sourceName = citation.getAttribute('data-source');
      if (sourceName) {
        this.citationClick.emit(sourceName);
        event.stopPropagation();
        return;
      }
    }

    // Handle Code Copy
    const copyBtn = target.closest('.copy-code-btn');
    if (copyBtn) {
      const codeBlock = copyBtn.parentElement?.querySelector('code');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
          this.toastr.success('Text copied!');
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
          }, 2000);
        });
        event.stopPropagation();
      }
    }
  }
}

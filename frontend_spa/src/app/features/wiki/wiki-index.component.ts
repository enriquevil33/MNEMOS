import { Component, signal, inject, OnInit, AfterViewChecked, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { WikiService } from '../../services/wiki.service';
import { WikiConceptStub } from '@core/models';
import { renderKatexInElement } from '../../shared/katex.util';

@Component({
  selector: 'app-wiki-index',
  standalone: true,
  template: `
<div class="wiki-index-layout">

  <!-- Header -->
  <header class="wiki-header">
    <h1 class="wiki-title">Wiki</h1>
    <p class="wiki-subtitle">Knowledge base extracted from your documents</p>

    <!-- Search box -->
    <div class="wiki-search-wrap">
      <input
        type="text"
        class="wiki-search-input"
        placeholder="Search concepts…"
        [value]="query()"
        (input)="onQueryInput($event)"
        (keydown.enter)="$event.preventDefault()"
        autocomplete="off"
      >
      <span class="wiki-search-count">
        {{ displayedConcepts().length }} result{{ displayedConcepts().length !== 1 ? 's' : '' }}
      </span>
    </div>
  </header>

  <!-- Letter tabs (A–Z + #) -->
  <nav class="wiki-alpha-nav">
    @for (letter of alphabetButtons; track letter) {
      <button
        class="wiki-alpha-btn"
        [class.active]="activeLetter() === letter"
        (click)="filterByLetter(letter)"
      >{{ letter }}</button>
    }
  </nav>

  <!-- Concept grid -->
  <section class="wiki-concept-grid">
    @if (loading()) {
      <div class="wiki-loading">
        <span class="loading-dots"><span></span><span></span><span></span></span>
      </div>
    } @else if (displayedConcepts().length === 0) {
      <p class="wiki-empty">No concepts found. Upload documents to populate the knowledge base.</p>
    } @else {
      @for (concept of displayedConcepts(); track concept.id) {
        <button class="wiki-concept-card" (click)="openArticle(concept.name)">
          <span class="wiki-concept-name">{{ concept.name }}</span>
          @if (concept.description) {
            <span class="wiki-concept-desc">{{ truncate(concept.description, 90) }}</span>
          }
        </button>
      }
    }
  </section>

  <!-- Pagination -->
  @if (!loading() && total() > limit) {
    <footer class="wiki-pagination">
      <button class="btn-secondary" [disabled]="offset() === 0" (click)="page(-1)">← Previous</button>
      <span class="wiki-page-info">{{ offset() / limit + 1 }} / {{ totalPages() }}</span>
      <button class="btn-secondary" [disabled]="offset() + limit >= total()" (click)="page(1)">Next →</button>
    </footer>
  }

</div>
  `,
  styleUrl: './wiki-index.component.css'
})
export class WikiIndexComponent implements OnInit, AfterViewChecked {
  private router = inject(Router);
  private wikiService = inject(WikiService);
  private el = inject(ElementRef);
  private lastRenderedCount = -1;

  // State
  query = signal('');
  allConcepts = signal<WikiConceptStub[]>([]);
  displayedConcepts = signal<WikiConceptStub[]>([]);
  activeLetter = signal<string>('');
  loading = signal(true);
  total = signal(0);
  offset = signal(0);
  readonly limit = 200;

  readonly alphabetButtons = ['#', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

  ngOnInit() {
    this.fetchAll();
  }

  ngAfterViewChecked() {
    const count = this.displayedConcepts().length;
    if (count !== this.lastRenderedCount && !this.loading()) {
      this.lastRenderedCount = count;
      renderKatexInElement(this.el.nativeElement);
    }
  }

  private fetchAll() {
    this.loading.set(true);
    this.wikiService.listConcepts('', 500, 0).subscribe({
      next: (res) => {
        this.allConcepts.set(res.concepts);
        this.total.set(res.total);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private applyFilter() {
    let list = this.allConcepts();
    const q = this.query().trim().toLowerCase();
    const letter = this.activeLetter();

    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    if (letter === '#') {
      list = list.filter(c => !/^[a-z]/i.test(c.name));
    } else if (letter) {
      list = list.filter(c => c.name.toLowerCase().startsWith(letter.toLowerCase()));
    }

    // Sort alphabetically
    list.sort((a, b) => a.name.localeCompare(b.name));
    this.displayedConcepts.set(list);
    this.total.set(list.length);
  }

  onQueryInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeLetter.set('');
    this.applyFilter();
  }

  filterByLetter(letter: string) {
    this.activeLetter.set(this.activeLetter() === letter ? '' : letter);
    this.query.set('');
    this.applyFilter();
  }

  openArticle(name: string) {
    this.router.navigate(['/wiki', name]);
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // Pagination helpers (only meaningful if we switch to server-side paging)
  totalPages() {
    return Math.ceil(this.total() / this.limit) || 1;
  }
  page(dir: number) {
    this.offset.set(Math.max(0, this.offset() + dir * this.limit));
  }
}

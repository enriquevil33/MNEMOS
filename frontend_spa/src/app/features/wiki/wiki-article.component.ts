import { Component, signal, inject, OnInit, OnDestroy, AfterViewChecked, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WikiService } from '../../services/wiki.service';
import { WikiArticle, WikiSource, MessageSource } from '@core/models';
import { Subscription } from 'rxjs';
import { renderKatexInElement } from '../../shared/katex.util';
import { ModalService } from '../../services/modal.service';
import { ApiEndpoints } from '@core/constants/api-endpoints';
import { SourceModalComponent } from '../../shared/components/source-modal';

@Component({
  selector: 'app-wiki-article',
  standalone: true,
  imports: [SourceModalComponent],
  template: `
<div class="wiki-article-layout">

  <!-- Back link -->
  <nav class="wiki-breadcrumb">
    <button class="wiki-back-link" (click)="goBack()">← Wiki</button>
    @if (article()) {
      <span class="wiki-breadcrumb-sep">/</span>
      <span class="wiki-breadcrumb-current">{{ article()!.name }}</span>
    }
  </nav>

  <!-- Loading -->
  @if (loading()) {
    <div class="wiki-article-loading">
      <span class="loading-dots"><span></span><span></span><span></span></span>
    </div>
  }

  <!-- Error -->
  @if (error()) {
    <div class="wiki-article-error">
      <p>{{ error() }}</p>
      <button class="btn-secondary" (click)="goBack()">← Back to Wiki</button>
    </div>
  }

  <!-- Article body -->
  @if (article() && !loading()) {
    <article class="wiki-article">

      <!-- Title -->
      <h1 class="wiki-article-title">{{ article()!.name }}</h1>

      <!-- Description -->
      @if (article()!.description) {
        <p class="wiki-article-desc">{{ article()!.description }}</p>
      }

      <!-- Relations -->
      @if (article()!.relations.length > 0) {
        <section class="wiki-article-section">
          <h2 class="wiki-section-heading">Relations</h2>
          <ul class="wiki-relations-list">
            @for (rel of article()!.relations; track $index) {
              <li class="wiki-relation-item">
                <span class="wiki-relation-text">{{ rel.description }}</span>
                @if (rel.peers.length > 0) {
                  <span class="wiki-relation-peers">
                    @for (peer of rel.peers; track peer.id) {
                      <button class="wiki-peer-link" (click)="navigateTo(peer.name)">{{ peer.name }}</button>
                    }
                  </span>
                }
              </li>
            }
          </ul>
        </section>
      }

      <!-- Related concepts -->
      @if (article()!.related.length > 0) {
        <section class="wiki-article-section">
          <h2 class="wiki-section-heading">See Also</h2>
          <div class="wiki-related-grid">
            @for (rel of article()!.related; track rel.id) {
              <button class="wiki-related-card" (click)="navigateTo(rel.name)">
                <span class="wiki-related-name">{{ rel.name }}</span>
                @if (rel.description) {
                  <span class="wiki-related-desc">{{ truncate(rel.description, 70) }}</span>
                }
              </button>
            }
          </div>
        </section>
      }

      <!-- Source citations -->
      @if (article()!.sources.length > 0) {
        <section class="wiki-article-section wiki-sources-section">
          <h2 class="wiki-section-heading">Sources</h2>
          <div class="wiki-sources-list">
            @for (src of article()!.sources; track src.chunk_id; let idx = $index) {
              <div class="wiki-source-item">
                <div class="wiki-source-header">
                  <button class="wiki-source-badge" (click)="openSource(src)" title="Open in document">
                    [{{ idx + 1 }}]
                  </button>
                  <span class="wiki-source-doc">{{ src.document_title }}</span>
                  @if (src.page_number) {
                    <span class="wiki-source-page">p. {{ src.page_number }}</span>
                  }
                  @if (src.start_time != null) {
                    <span class="wiki-source-page">{{ formatTime(src.start_time) }}</span>
                  }
                </div>
                <p class="wiki-source-content">{{ src.content }}</p>
              </div>
            }
          </div>
        </section>
      }

    </article>
  }

</div>

<!-- Fallback source modal (epub / unknown types) -->
<app-source-modal
  [isOpen]="isSourceModalOpen()"
  [source]="selectedSource()"
  (close)="closeSourceModal()">
</app-source-modal>
  `,
  styleUrl: './wiki-article.component.css'
})
export class WikiArticleComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wikiService = inject(WikiService);
  private modalService = inject(ModalService);
  private el = inject(ElementRef);
  private sub!: Subscription;
  private lastRenderedArticleId = '';

  article = signal<WikiArticle | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isSourceModalOpen = signal(false);
  selectedSource = signal<MessageSource | null>(null);

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe(params => {
      const name = params.get('name');
      if (name) this.loadArticle(name);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  ngAfterViewChecked() {
    const art = this.article();
    if (art && art.id !== this.lastRenderedArticleId) {
      this.lastRenderedArticleId = art.id;
      renderKatexInElement(this.el.nativeElement);
    }
  }

  private loadArticle(name: string) {
    this.loading.set(true);
    this.error.set(null);
    this.article.set(null);

    this.wikiService.getArticle(name).subscribe({
      next: (data) => {
        this.article.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(`Article "${name}" not found.`);
        this.loading.set(false);
      }
    });
  }

  goBack() {
    this.router.navigate(['/wiki']);
  }

  navigateTo(conceptName: string) {
    this.router.navigate(['/wiki', conceptName]);
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  /** youtube → video/audio → pdf → fallback inline modal */
  openSource(src: WikiSource) {

    if (src.file_type === 'youtube' && src.youtube_url) {
      this.modalService.openYoutubeViewer(src.youtube_url, src.start_time ?? undefined);
    } else if (src.file_type === 'video' || src.file_type === 'audio') {
      const url = ApiEndpoints.DOCUMENT_CONTENT(src.document_id);
      this.modalService.openVideoPlayer(url, src.start_time ?? undefined);
    } else if (src.file_type === 'pdf') {
      const doc: any = {
        id: src.document_id,
        original_filename: src.document_title,
        file_type: 'pdf'
      };
      this.modalService.openPdfViewer(doc, src.content, src.page_number ?? undefined);
    } else {
      // epub / unknown — show inline source modal
      this.selectedSource.set({
        document: src.document_title,
        document_id: src.document_id,
        text: src.content,
        page_number: src.page_number ?? undefined,
        start_time: src.start_time ?? undefined,
        end_time: src.end_time ?? undefined,
        file_type: src.file_type ?? undefined,
        score: 1,
        location: src.page_number ? `p. ${src.page_number}` : undefined,
      });
      this.isSourceModalOpen.set(true);
    }
  }

  closeSourceModal() {
    this.isSourceModalOpen.set(false);
    this.selectedSource.set(null);
  }

  /** Seconds → m:ss */
  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

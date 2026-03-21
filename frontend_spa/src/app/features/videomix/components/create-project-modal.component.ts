import { Component, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsService } from '@services/documents.service';
import { VideoMixService } from '@services/videomix.service';
import { CreateVideoMixProjectRequest } from '@core/models/videomix.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="onBackdropClick($event)">
      <div class="bg-panel rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-primary">Create New Video Mix</h2>
          <button (click)="close.emit()" class="p-2 hover:bg-hover rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <form class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-primary mb-2">
                Project Title <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [ngModel]="title()"
                (ngModelChange)="title.set($event); saveDraft()"
                name="title"
                placeholder="e.g., Product Demo Highlights"
                class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary placeholder-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                required>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-primary mb-2">
                Description (Optional)
              </label>
              <textarea
                [ngModel]="description()"
                (ngModelChange)="description.set($event); saveDraft()"
                name="description"
                rows="2"
                placeholder="Brief description of this video mix project"
                class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary placeholder-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none">
              </textarea>
            </div>

            <!-- User Prompt -->
            <div>
              <label class="block text-sm font-medium text-primary mb-2">
                What do you want to create? <span class="text-red-500">*</span>
              </label>
              <textarea
                [ngModel]="user_prompt()"
                (ngModelChange)="user_prompt.set($event); saveDraft()"
                name="user_prompt"
                rows="3"
                placeholder="Describe the video you want to create. The AI will analyze your videos and select the best segments based on this prompt."
                class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary placeholder-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                required>
              </textarea>
              <p class="text-xs text-secondary mt-1">
                Example: "Create a 3-minute highlight reel showing the best moments from our product demos"
              </p>
            </div>

            <!-- Document Selection -->
            <div>
              <label class="block text-sm font-medium text-primary mb-2">
                Select Videos <span class="text-red-500">*</span>
              </label>
              <div class="bg-background border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
                @if (videoDocuments().length === 0) {
                  <p class="text-sm text-secondary text-center py-8">
                    No video documents found in your library. Please upload videos first.
                  </p>
                } @else {
                  <div class="space-y-2">
                    @for (doc of videoDocuments(); track doc.id) {
                      <label class="flex items-center gap-3 p-2 hover:bg-hover rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          [checked]="selectedDocumentIds().includes(doc.id)"
                          (change)="toggleDocument(doc.id)"
                          class="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-primary font-medium truncate">{{ doc.original_filename }}</p>
                          <p class="text-xs text-secondary">{{ doc.file_type }}</p>
                        </div>
                      </label>
                    }
                  </div>
                }
              </div>
              @if (selectedDocumentIds().length > 0) {
                <p class="text-xs text-secondary mt-2">
                  {{ selectedDocumentIds().length }} video(s) selected
                </p>
              }
            </div>

            <!-- Settings Row -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Resolution -->
              <div>
                <label class="block text-sm font-medium text-primary mb-2">
                  Resolution
                </label>
                <select
                  [ngModel]="resolution()"
                  (ngModelChange)="resolution.set($event); saveDraft()"
                  name="resolution"
                  class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50">
                  <option value="source">Source (Original)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p (SD)</option>
                </select>
              </div>

              <!-- Max Duration -->
              <div>
                <label class="block text-sm font-medium text-primary mb-2">
                  Max Duration (Optional)
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    [ngModel]="maxDurationMinutes()"
                    (ngModelChange)="maxDurationMinutes.set($event); saveDraft()"
                    name="maxDuration"
                    min="1"
                    max="60"
                    placeholder="None"
                    class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary placeholder-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50">
                  <span class="text-sm text-secondary whitespace-nowrap">min</span>
                </div>
              </div>
            </div>

            <!-- Toggles -->
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="title_cards_enabled()"
                  (ngModelChange)="title_cards_enabled.set($event); saveDraft()"
                  name="title_cards"
                  class="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent">
                <div class="flex-1">
                  <p class="text-sm font-medium text-primary">Enable Title Cards</p>
                  <p class="text-xs text-secondary">Add title cards between video segments</p>
                </div>
              </label>

              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="audio_normalization()"
                  (ngModelChange)="audio_normalization.set($event); saveDraft()"
                  name="audio_normalization"
                  class="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent">
                <div class="flex-1">
                  <p class="text-sm font-medium text-primary">Normalize Audio</p>
                  <p class="text-xs text-secondary">Balance audio levels across all clips (recommended)</p>
                </div>
              </label>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            (click)="close.emit()"
            class="px-4 py-2 text-sm font-medium text-secondary hover:bg-hover rounded-lg transition-colors">
            Cancel
          </button>
          <button
            (click)="createProject()"
            [disabled]="!isValid() || isCreating()"
            class="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            @if (isCreating()) {
              <span class="flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            } @else {
              Create Project
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class CreateProjectModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<string>(); // Emits project ID

  private documentsService = inject(DocumentsService);
  private videoMixService = inject(VideoMixService);
  private toastr = inject(ToastrService);

  private readonly DRAFT_KEY = 'videomix_draft_project';

  // Using signals for reactivity
  title = signal<string>('');
  description = signal<string>('');
  user_prompt = signal<string>('');
  resolution = signal<'1080p' | '720p' | '480p' | 'source'>('1080p');
  title_cards_enabled = signal<boolean>(false);
  audio_normalization = signal<boolean>(true);
  maxDurationMinutes = signal<number | null>(null);
  selectedDocumentIds = signal<string[]>([]);
  isCreating = signal<boolean>(false);

  constructor() {
    this.loadDraft();
  }

  // Filter documents to only show video/audio types
  videoDocuments = computed(() => {
    return this.documentsService.documents().filter(doc =>
      doc.file_type === 'video' || doc.file_type === 'audio' || doc.file_type === 'youtube'
    );
  });

  isValid = computed(() => {
    return this.title().trim().length > 0 &&
           this.user_prompt().trim().length > 0 &&
           this.selectedDocumentIds().length > 0;
  });

  toggleDocument(id: string): void {
    this.selectedDocumentIds.update(ids => {
      if (ids.includes(id)) {
        return ids.filter(docId => docId !== id);
      } else {
        return [...ids, id];
      }
    });
    this.saveDraft();
  }

  loadDraft(): void {
    try {
      const draft = localStorage.getItem(this.DRAFT_KEY);
      if (draft) {
        const data = JSON.parse(draft);
        this.title.set(data.title || '');
        this.description.set(data.description || '');
        this.user_prompt.set(data.user_prompt || '');
        this.resolution.set(data.resolution || '1080p');
        this.title_cards_enabled.set(data.title_cards_enabled || false);
        this.audio_normalization.set(data.audio_normalization ?? true);
        this.maxDurationMinutes.set(data.maxDurationMinutes || null);
        this.selectedDocumentIds.set(data.selectedDocumentIds || []);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  }

  saveDraft(): void {
    try {
      const draft = {
        title: this.title(),
        description: this.description(),
        user_prompt: this.user_prompt(),
        resolution: this.resolution(),
        title_cards_enabled: this.title_cards_enabled(),
        audio_normalization: this.audio_normalization(),
        maxDurationMinutes: this.maxDurationMinutes(),
        selectedDocumentIds: this.selectedDocumentIds()
      };
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }

  clearDraft(): void {
    try {
      localStorage.removeItem(this.DRAFT_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  async createProject(): Promise<void> {
    if (!this.isValid() || this.isCreating()) return;

    this.isCreating.set(true);

    try {
      const request: CreateVideoMixProjectRequest = {
        title: this.title().trim(),
        description: this.description().trim() || undefined,
        user_prompt: this.user_prompt().trim(),
        document_ids: this.selectedDocumentIds(),
        resolution: this.resolution(),
        title_cards_enabled: this.title_cards_enabled(),
        max_duration_seconds: this.maxDurationMinutes() ? this.maxDurationMinutes()! * 60 : undefined,
        audio_normalization: this.audio_normalization()
      };

      const project = await this.videoMixService.createProject(request);
      this.clearDraft(); // Clear draft on successful creation
      this.toastr.success('Project created successfully!');
      this.created.emit(project.id);
      this.close.emit();
    } catch (error) {
      console.error('Failed to create project:', error);
      this.toastr.error('Failed to create project. Please try again.');
    } finally {
      this.isCreating.set(false);
    }
  }
}

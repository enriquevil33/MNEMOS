import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Collection } from '../../../core/models/collection.model';
import { Document } from '../../../core/models/document.model';
import { DocumentsService } from '../../../services/documents.service';

@Component({
    selector: 'app-collection-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-panel border border-divider rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-divider shrink-0">
            <h3 class="text-lg font-bold">{{ collection ? 'Edit' : 'New' }} Collection</h3>
            <button (click)="cancel.emit()" class="p-1 rounded-full text-secondary hover:bg-hover transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Tabs (only show Documents tab when editing an existing collection) -->
          <div class="flex gap-1 px-6 pt-4 shrink-0">
            <button
              (click)="activeTab = 'details'"
              class="px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
              [class.bg-base-200]="activeTab === 'details'"
              [class.text-primary]="activeTab === 'details'"
              [class.text-secondary]="activeTab !== 'details'">
              Details
            </button>
            @if (collection) {
              <button
                (click)="activeTab = 'documents'"
                class="px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors"
                [class.bg-base-200]="activeTab === 'documents'"
                [class.text-primary]="activeTab === 'documents'"
                [class.text-secondary]="activeTab !== 'documents'">
                Documents
              </button>
            }
          </div>

          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto custom-scrollbar">

            <!-- ========== Details Tab ========== -->
            @if (activeTab === 'details') {
              <div class="p-6 space-y-4">

                @if (errorMessage) {
                  <div class="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                    {{ errorMessage }}
                  </div>
                }

                <div>
                  <label class="block text-sm font-medium text-secondary mb-1">Name</label>
                  <input
                    type="text"
                    [(ngModel)]="name"
                    [disabled]="isLoading"
                    placeholder="Collection name"
                    class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-secondary mb-1">Description</label>
                  <textarea
                    [(ngModel)]="description"
                    [disabled]="isLoading"
                    placeholder="Optional description"
                    rows="3"
                    class="w-full px-3 py-2 rounded-lg border border-divider bg-input text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 resize-none"
                  ></textarea>
                </div>
              </div>
            }

            <!-- ========== Documents Tab ========== -->
            @if (activeTab === 'documents') {
              <div class="p-6 space-y-4">

                <div class="space-y-4">

                  <!-- Documents already in this collection -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-semibold uppercase tracking-wider text-secondary">In this collection</span>
                      <span class="text-xs text-secondary">{{ collectionDocs().length }}</span>
                    </div>
                    @if (collectionDocs().length === 0) {
                      <div class="text-secondary text-sm text-center py-3 border border-dashed border-divider rounded-lg">
                        No documents yet
                      </div>
                    }
                    <div class="space-y-1.5">
                      @for (doc of collectionDocs(); track doc.id) {
                        <div class="flex items-center justify-between px-3 py-2 rounded-lg border border-divider bg-base-200">
                          <div class="flex items-center gap-2.5 overflow-hidden">
                            <span class="text-xs font-bold uppercase text-secondary shrink-0 w-7 text-center">{{ doc.file_type.slice(0,3) }}</span>
                            <span class="text-sm text-primary truncate">{{ doc.tag || doc.original_filename }}</span>
                            @if (doc.status !== 'completed') {
                              <span class="text-xs text-secondary shrink-0">({{ doc.status }})</span>
                            }
                          </div>
                          <!-- Remove from collection -->
                          <button (click)="removeFromCollection(doc)" title="Remove from collection" class="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Divider -->
                  <div class="border-t border-divider"></div>

                  <!-- Add documents: search input + filtered picker list -->
                  <div>
                    <span class="text-xs font-semibold uppercase tracking-wider text-secondary mb-2 block">Add documents</span>

                    <!-- Search input -->
                    <div class="flex items-center gap-2 px-3 py-2 bg-input border border-divider rounded-lg focus-within:ring-2 focus-within:ring-accent/50 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-secondary shrink-0">
                        <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
                      </svg>
                      <input
                        type="text"
                        [(ngModel)]="addSearch"
                        placeholder="Search documents..."
                        class="grow bg-transparent border-none focus:outline-none text-sm text-primary placeholder-secondary"
                      />
                      @if (addSearch) {
                        <button (click)="addSearch = ''" class="text-secondary hover:text-primary transition-colors shrink-0">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      }
                    </div>

                    <!-- Filtered available docs list -->
                    <div class="max-h-48 overflow-y-auto custom-scrollbar rounded-lg border border-divider">
                      @if (filteredAvailable().length === 0) {
                        <div class="text-secondary text-sm text-center py-3">
                          {{ addSearch ? 'No matches' : 'All documents are in this collection' }}
                        </div>
                      }
                      @for (doc of filteredAvailable(); track doc.id) {
                        <button
                          (click)="addDocument(doc.id)"
                          class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/10 hover:border-accent/30 border-b border-divider last:border-b-0 transition-colors group">
                          <span class="text-xs font-bold uppercase text-secondary shrink-0 w-7 text-center group-hover:text-accent">{{ doc.file_type.slice(0,3) }}</span>
                          <span class="text-sm text-primary truncate group-hover:text-accent">{{ doc.tag || doc.original_filename }}</span>
                          <svg class="w-4 h-4 text-secondary group-hover:text-accent ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                          </svg>
                        </button>
                      }
                    </div>
                  </div>

                </div>
              </div>
            }

          </div> <!-- end scrollable body -->

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-divider shrink-0">
            <button (click)="cancel.emit()" class="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-hover transition-colors">
              {{ collection ? 'Close' : 'Cancel' }}
            </button>
            <button
              (click)="onSave()"
              [disabled]="isLoading || !name.trim()"
              class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-accent hover:bg-accent-dark shadow-lg hover:shadow-accent/40 active:scale-95 transition-all disabled:opacity-40 disabled:shadow-none">
              {{ isLoading ? 'Saving...' : (collection ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class CollectionModalComponent implements OnChanges {
    @Input() isOpen = false;
    @Input() collection: Collection | null = null;
    @Input() isLoading = false;
    @Input() errorMessage = '';

    @Output() save = new EventEmitter<Partial<Collection>>();
    @Output() cancel = new EventEmitter<void>();

    private docsService = inject(DocumentsService);

    // Details tab state
    name = '';
    description = '';

    // Documents tab state
    activeTab: 'details' | 'documents' = 'details';
    addSearch = '';

    // Derived from the already-loaded DocumentsService.documents signal — no extra fetches
    collectionDocs = computed(() => {
        const id = this.collection?.id;
        if (!id) return [];
        return this.docsService.documents().filter((d: Document) => d.collection_id === id);
    });

    availableDocs = computed(() => {
        const id = this.collection?.id;
        if (!id) return [];
        return this.docsService.documents().filter((d: Document) => d.collection_id !== id);
    });

    filteredAvailable = computed(() => {
        const q = this.addSearch.toLowerCase();
        if (!q) return this.availableDocs();
        return this.availableDocs().filter((d: Document) =>
            (d.tag || d.original_filename).toLowerCase().includes(q)
        );
    });

    ngOnChanges(changes: SimpleChanges) {
        if (changes['collection']) {
            this.name = this.collection?.name ?? '';
            this.description = this.collection?.description ?? '';
            this.activeTab = 'details';
            this.addSearch = '';
        }
    }

    // ─── Details tab ─────────────────────────────────────────────

    onSave() {
        this.save.emit({
            name: this.name.trim(),
            description: this.description.trim()
        });
    }

    // ─── Documents tab ───────────────────────────────────────────
    // updateDocument / removeDocument already mutate DocumentsService.documents
    // so the computed signals above react automatically — no reload needed.

    async addDocument(docId: string) {
        if (!this.collection) return;
        await this.docsService.updateDocument(docId, { collection_id: this.collection.id });
    }

    async removeFromCollection(doc: Document) {
        await this.docsService.updateDocument(doc.id, { collection_id: null });
    }

    async deleteDocument(doc: Document) {
        if (!confirm(`Delete "${doc.tag || doc.original_filename}"? This cannot be undone.`)) return;
        await this.docsService.removeDocument(doc.id);
    }
}

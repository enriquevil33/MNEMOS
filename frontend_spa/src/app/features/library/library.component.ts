import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DocumentsService } from '../../services/documents.service';
import { CollectionService } from '../../services/collection.service';
import { Collection } from '../../core/models/collection.model';
import { Document } from '../../core/models/document.model';
import { FilterBarComponent } from './filter-bar/filter-bar.component';
import { LibraryDocumentModalComponent } from './library-document-modal/library-document-modal.component';

@Component({
    selector: 'app-library-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, FilterBarComponent, LibraryDocumentModalComponent],
    template: `
    <div class="container mx-auto p-4 h-full flex flex-col">
      <h1 class="text-3xl font-bold mb-6">Library</h1>
      
      <!-- Filter Bar -->
      <app-filter-bar
        [collections]="collections()"
        [selectedCount]="docService.selectedCount()"
        (filterChange)="onFilterChange($event)"
        (createCollection)="openCollectionModal()"
        (addToCollection)="openAddToCollectionModal()">
      </app-filter-bar>

      <!-- Document Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto flex-grow content-start">
        @for (doc of filteredDocuments(); track doc.id) {
        <div class="bg-panel rounded-lg shadow-sm border border-divider hover:shadow-md hover:bg-base-200/50 transition-all relative group cursor-pointer flex flex-col h-full"
             [class.bg-accent]="doc.selected"
             [class.bg-opacity-10]="doc.selected"
             (click)="openDocument(doc)">

             <!-- Checkbox (top-right, clean design) -->
             <label class="absolute top-2 right-2 z-10 cursor-pointer flex items-center justify-center w-6 h-6 rounded bg-base-100/80 hover:bg-base-100 backdrop-blur-sm transition-all"
                    [class.bg-accent]="doc.selected"
                    [class.text-white]="doc.selected"
                    (click)="$event.stopPropagation()">
                <input type="checkbox"
                       [checked]="doc.selected"
                       (change)="toggleDocumentSelection(doc.id)"
                       class="sr-only" />
                @if (doc.selected) {
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                </svg>
                } @else {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-secondary opacity-60">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                }
             </label>

             <div class="flex justify-between items-start mb-2 p-4">
                <span class="px-2 py-0.5 text-xs font-medium border border-divider rounded-full text-secondary">{{ doc.file_type | uppercase }}</span>
                @if (doc.stars) {
                <div class="flex text-warning">
                    @for (i of [].constructor(doc.stars); track $index) {
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3">
                            <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" />
                        </svg>
                    }
                </div>
                }
             </div>

             <h2 class="text-sm font-semibold mb-2 line-clamp-2 min-h-[2.5rem] px-4" [title]="doc.original_filename">
                {{ doc.tag || doc.original_filename }}
             </h2>

             <div class="flex items-center justify-between text-xs text-secondary mt-auto py-2 px-4 border-t border-divider">
                <span>{{ doc.created_at | date:'mediumDate' }}</span>
                @if (doc.collection_id) {
                <span class="px-2 py-0.5 bg-hover rounded-full max-w-[50%] truncate">
                    {{ getCollectionName(doc.collection_id) }}
                </span>
                }
             </div>
        </div>
        }
        
        <!-- Empty State -->
        @if (filteredDocuments().length === 0) {
        <div class="col-span-full text-center py-10 opacity-50">
            No documents found matching filters.
        </div>
        }
      </div>

      <!-- Document Modal -->
      <app-library-document-modal
        [document]="selectedDocument"
        [collections]="collections()"
        [isOpen]="!!selectedDocument"
        (onClose)="closeModal()"
        (onSave)="saveDocument($event)"
      ></app-library-document-modal>

      <!-- Collection Creation Modal -->
      <div class="modal" [class.modal-open]="isCollectionModalOpen">
         <div class="modal-backdrop" (click)="closeCollectionModal()"></div>

         <div class="modal-box bg-panel border border-divider p-0 overflow-hidden">
            <div class="flex items-center justify-between p-4 sm:p-6 border-b border-divider bg-panel/50">
                <h3 class="font-bold text-lg text-primary">Create Collection</h3>
                <button (click)="closeCollectionModal()" class="btn btn-ghost btn-sm btn-circle text-secondary hover:text-primary">
                   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                   </svg>
                </button>
            </div>

            <form [formGroup]="collectionForm" (ngSubmit)="onCollectionSubmit()">
               <div class="p-4 sm:p-6 space-y-4">
                   <div class="form-control w-full">
                       <label class="block text-sm font-medium text-base-content mb-2">Name</label>
                       <input type="text" formControlName="name" class="w-full px-3 py-2 bg-input border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-base-content placeholder-secondary/50" placeholder="e.g., Research Papers" />
                   </div>

                   <div class="form-control w-full">
                       <label class="block text-sm font-medium text-base-content mb-2">Description</label>
                       <textarea formControlName="description" class="w-full px-3 py-2 bg-input border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent h-24 text-base-content placeholder-secondary/50 resize-none" placeholder="Optional description"></textarea>
                   </div>

                   <div class="text-sm text-secondary">
                       {{ docService.selectedCount() }} document(s) will be added to this collection
                   </div>
               </div>

               <div class="flex items-center justify-end gap-2 p-4 sm:p-6 border-t border-divider bg-panel/50">
                   <button type="button" class="btn btn-ghost text-secondary hover:text-primary" (click)="closeCollectionModal()">Cancel</button>
                   <button type="submit" class="btn btn-primary" [disabled]="collectionForm.invalid">
                       Create Collection
                   </button>
               </div>
            </form>
         </div>
      </div>

      <!-- Add to Existing Collection Modal -->
      <div class="modal" [class.modal-open]="isAddToCollectionModalOpen">
         <div class="modal-backdrop" (click)="closeAddToCollectionModal()"></div>

         <div class="modal-box bg-panel border border-divider p-0 overflow-hidden">
            <div class="flex items-center justify-between p-4 sm:p-6 border-b border-divider bg-panel/50">
                <h3 class="font-bold text-lg text-primary">Add to Collection</h3>
                <button (click)="closeAddToCollectionModal()" class="btn btn-ghost btn-sm btn-circle text-secondary hover:text-primary">
                   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                   </svg>
                </button>
            </div>

            <form (ngSubmit)="onAddToCollectionSubmit()">
               <div class="p-4 sm:p-6 space-y-4">
                   <div class="form-control w-full">
                       <label class="block text-sm font-medium text-base-content mb-2">Select Collection</label>
                       <select [(ngModel)]="selectedCollectionId" name="collectionId"
                               class="w-full px-3 py-2 bg-input border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-base-content">
                           <option [ngValue]="null" disabled>Choose a collection...</option>
                           @for (col of collections(); track col.id) {
                             <option [value]="col.id">{{ col.name }}</option>
                           }
                       </select>
                   </div>

                   <div class="text-sm text-secondary">
                       {{ docService.selectedCount() }} document(s) will be added to the selected collection
                   </div>
               </div>

               <div class="flex items-center justify-end gap-2 p-4 sm:p-6 border-t border-divider bg-panel/50">
                   <button type="button" class="btn btn-ghost text-secondary hover:text-primary" (click)="closeAddToCollectionModal()">Cancel</button>
                   <button type="submit" class="btn btn-primary" [disabled]="!selectedCollectionId">
                       Add to Collection
                   </button>
               </div>
            </form>
         </div>
      </div>
    </div>
  `
})
export class LibraryPageComponent implements OnInit {
    docService = inject(DocumentsService);
    private colService = inject(CollectionService);
    private fb = inject(FormBuilder);

    collections = signal<Collection[]>([]);
    documents = this.docService.documents; // Signal from service

    // Local filter state
    filterSearch = '';
    filterCollection: string | null = null; // null = all, 'uncategorized' = null in DB
    filterType: string | null = null;

    selectedDocument: Document | null = null;

    // Collection modal state
    isCollectionModalOpen = false;
    collectionForm = this.fb.group({
        name: ['', Validators.required],
        description: ['']
    });

    // Add to existing collection modal
    isAddToCollectionModalOpen = false;
    selectedCollectionId: string | null = null;

    ngOnInit() {
        this.loadData();
    }

    async loadData() {
        // Load collections
        this.colService.getCollections().subscribe({
            next: (cols) => this.collections.set(cols),
            error: (err) => console.error('Failed to load collections', err)
        });

        // Load documents (initially all)
        await this.docService.fetchDocuments();
    }

    onFilterChange(filters: any) {
        this.filterSearch = filters.search.toLowerCase();
        this.filterCollection = filters.collectionId;
        this.filterType = filters.fileType;
    }

    // Computed filtering logic
    filteredDocuments() {
        return this.documents().filter(doc => {
            // Search
            const matchesSearch = !this.filterSearch ||
                (doc.original_filename && doc.original_filename.toLowerCase().includes(this.filterSearch)) ||
                (doc.tag && doc.tag.toLowerCase().includes(this.filterSearch)) ||
                (doc.comment && doc.comment.toLowerCase().includes(this.filterSearch));

            // Collection
            let matchesCollection = true;
            if (this.filterCollection === 'uncategorized') {
                matchesCollection = !doc.collection_id;
            } else if (this.filterCollection) {
                matchesCollection = doc.collection_id === this.filterCollection;
            }

            // Type
            const matchesType = !this.filterType || doc.file_type === this.filterType;

            return matchesSearch && matchesCollection && matchesType;
        });
    }

    getCollectionName(id: string): string {
        return this.collections().find(c => c.id === id)?.name || 'Unknown';
    }

    openDocument(doc: Document) {
        this.selectedDocument = doc;
    }

    closeModal() {
        this.selectedDocument = null;
    }

    async saveDocument(updates: Partial<Document>) {
        if (this.selectedDocument) {
            try {
                await this.docService.updateDocument(this.selectedDocument.id, updates);
                this.closeModal();
                // Refresh collections just in case? No need usually.
            } catch (err) {
                alert('Failed to save document');
            }
        }
    }

    toggleDocumentSelection(docId: string) {
        this.docService.toggleDocument(docId);
    }

    openCollectionModal() {
        this.collectionForm.reset();
        this.isCollectionModalOpen = true;
    }

    closeCollectionModal() {
        this.isCollectionModalOpen = false;
    }

    async onCollectionSubmit() {
        if (this.collectionForm.invalid) return;

        const selectedIds = this.docService.getSelectedIds();
        if (selectedIds.length === 0) return;

        try {
            const collectionData = this.collectionForm.value;
            const newCollection = await this.colService.createCollection(collectionData as any).toPromise();

            if (newCollection) {
                // Update all selected documents with the new collection_id
                await Promise.all(
                    selectedIds.map(id => this.docService.updateDocument(id, { collection_id: newCollection.id }))
                );

                // Clear selection and refresh
                this.docService.clearSelection();
                await this.loadData();
                this.closeCollectionModal();
            }
        } catch (err) {
            console.error('Failed to create collection', err);
            alert('Failed to create collection');
        }
    }

    openAddToCollectionModal() {
        this.selectedCollectionId = null;
        this.isAddToCollectionModalOpen = true;
    }

    closeAddToCollectionModal() {
        this.isAddToCollectionModalOpen = false;
        this.selectedCollectionId = null;
    }

    async onAddToCollectionSubmit() {
        if (!this.selectedCollectionId) return;

        const selectedIds = this.docService.getSelectedIds();
        if (selectedIds.length === 0) return;

        try {
            // Update all selected documents with the collection_id
            await Promise.all(
                selectedIds.map(id => this.docService.updateDocument(id, { collection_id: this.selectedCollectionId }))
            );

            // Clear selection and refresh
            this.docService.clearSelection();
            await this.loadData();
            this.closeAddToCollectionModal();
        } catch (err) {
            console.error('Failed to add documents to collection', err);
            alert('Failed to add documents to collection');
        }
    }
}

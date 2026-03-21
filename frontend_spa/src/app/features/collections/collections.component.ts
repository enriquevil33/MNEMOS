import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollectionService } from '../../services/collection.service';
import { Collection } from '../../core/models/collection.model';
import { CollectionModalComponent } from './collection-modal/collection-modal.component';

@Component({
    selector: 'app-collections-page',
    standalone: true,
    imports: [CommonModule, CollectionModalComponent],
    template: `
    <div class="container mx-auto p-4 max-w-4xl">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Collections</h1>
        <button class="btn btn-primary" (click)="openCreateModal()">
          + New Collection
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (col of collections(); track col.id) {
          <div class="bg-panel rounded-lg shadow-sm border border-divider p-4 transition-shadow hover:shadow-md">
            <div class="flex justify-between items-start mb-2">
              <h2 class="text-xl font-semibold break-all">{{ col.name }}</h2>
              <div class="relative">
                <button class="btn-icon" (click)="toggleDropdown(col.id)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                  </svg>
                </button>
                @if (openDropdownId === col.id) {
                  <div class="absolute right-0 mt-1 z-10 p-2 shadow-lg bg-panel border border-divider rounded-lg w-52">
                    <button class="w-full text-left py-2 px-3 hover:bg-hover rounded-md transition-colors" (click)="openEditModal(col); closeDropdown()">
                      Edit
                    </button>
                    <button class="w-full text-left py-2 px-3 hover:bg-hover rounded-md text-error transition-colors" (click)="deleteCollection(col.id); closeDropdown()">
                      Delete
                    </button>
                  </div>
                }
              </div>
            </div>
            <p class="text-secondary text-sm mb-4 min-h-[3rem]">{{ col.description || 'No description' }}</p>
            <div class="flex justify-end border-t border-divider pt-3">
              <span class="text-xs text-secondary">Created: {{ col.created_at | date:'mediumDate' }}</span>
            </div>
          </div>
        }
      </div>

      <app-collection-modal
        [isOpen]="isModalOpen"
        [collection]="currentCollection"
        [isLoading]="isLoading"
        [errorMessage]="errorMessage"
        (save)="onSave($event)"
        (cancel)="closeModal()">
      </app-collection-modal>
    </div>
  `
})
export class CollectionsPageComponent implements OnInit {
    private colService = inject(CollectionService);

    collections = signal<Collection[]>([]);

    isModalOpen = false;
    currentCollection: Collection | null = null;
    isLoading = false;
    errorMessage = '';
    openDropdownId: string | null = null;

    ngOnInit() {
        this.loadCollections();
    }

    loadCollections() {
        this.colService.getCollections().subscribe({
            next: (cols) => this.collections.set(cols),
            error: (err) => console.error('Failed to load collections', err)
        });
    }

    openCreateModal() {
        this.currentCollection = null;
        this.errorMessage = '';
        this.isModalOpen = true;
    }

    openEditModal(col: Collection) {
        this.currentCollection = col;
        this.errorMessage = '';
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    toggleDropdown(id: string) {
        this.openDropdownId = this.openDropdownId === id ? null : id;
    }

    closeDropdown() {
        this.openDropdownId = null;
    }

    onSave(data: Partial<Collection>) {
        this.isLoading = true;
        this.errorMessage = '';

        const request$ = this.currentCollection
            ? this.colService.updateCollection(this.currentCollection.id, data)
            : this.colService.createCollection(data);

        request$.subscribe({
            next: (res) => {
                this.isLoading = false;
                this.loadCollections();
                this.closeModal();
            },
            error: (err) => {
                this.isLoading = false;
                if (err.status === 409) {
                    this.errorMessage = 'A collection with this name already exists.';
                } else {
                    this.errorMessage = 'An error occurred. Please try again.';
                }
            }
        });
    }

    deleteCollection(id: string) {
        if (confirm('Are you sure? Documents in this collection will be uncategorized.')) {
            this.colService.deleteCollection(id).subscribe(() => {
                this.loadCollections();
            });
        }
    }
}

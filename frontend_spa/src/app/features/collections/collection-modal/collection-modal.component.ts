import { Component, OnChanges, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Collection } from '../../../core/models/collection.model';

@Component({
    selector: 'app-collection-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="cancel.emit()"></div>

        <div class="relative w-full max-w-md bg-panel rounded-2xl shadow-2xl border border-divider overflow-hidden animate-fade-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-divider bg-panel/50">
            <h2 class="text-xl font-semibold text-primary">{{ collection() ? 'Edit Collection' : 'New Collection' }}</h2>
            <button (click)="cancel.emit()" class="btn btn-ghost btn-sm btn-circle" aria-label="Close modal">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">
            <div>
              <label class="text-xs font-medium text-secondary uppercase tracking-wide">Name</label>
              <input type="text" [(ngModel)]="name" placeholder="Collection name"
                class="mt-1 w-full h-10 px-3 bg-input border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-primary placeholder-secondary/50" />
            </div>

            <div>
              <label class="text-xs font-medium text-secondary uppercase tracking-wide">Description</label>
              <textarea [(ngModel)]="description" placeholder="Optional description" rows="3"
                class="mt-1 w-full px-3 py-2 bg-input border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-primary placeholder-secondary/50 resize-none"></textarea>
            </div>

            @if (errorMessage()) {
              <p class="text-error text-sm">{{ errorMessage() }}</p>
            }
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 p-6 border-t border-divider bg-panel/50">
            <button (click)="cancel.emit()" class="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-hover transition-colors">
              Cancel
            </button>
            <button (click)="onSave()" [disabled]="isLoading() || !name.trim()"
              class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-accent hover:bg-accent-dark shadow-lg hover:shadow-accent/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              @if (isLoading()) {
                <span class="loading-dots mr-1"><span></span><span></span><span></span></span>
              }
              {{ collection() ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class CollectionModalComponent implements OnChanges {
    isOpen = input.required<boolean>();
    collection = input<Collection | null>(null);
    isLoading = input<boolean>(false);
    errorMessage = input<string>('');

    save = output<Partial<Collection>>();
    cancel = output<void>();

    name = '';
    description = '';

    ngOnChanges() {
        if (this.collection()) {
            this.name = this.collection()!.name;
            this.description = this.collection()!.description ?? '';
        } else if (this.isOpen()) {
            this.name = '';
            this.description = '';
        }
    }

    onSave() {
        if (!this.name.trim()) return;
        this.save.emit({ name: this.name.trim(), description: this.description.trim() });
    }
}

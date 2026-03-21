import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
      <div class="bg-panel border border-divider rounded-xl shadow-2xl p-6 max-w-md w-full animate-fade-in transform scale-100 transition-all">
        
        <!-- Header -->
        <h3 class="text-xl font-bold text-primary mb-2">{{ title() }}</h3>
        
        <!-- Body -->
        <div class="text-secondary text-sm mb-6 leading-relaxed">
          {{ message() }}
          <div *ngIf="comment()" class="mt-3 p-3 bg-base-200 rounded-lg text-xs italic opacity-80 border-l-4 border-accent">
            {{ comment() }}
          </div>
        </div>

        <!-- Toggle (Optional) -->
        <div *ngIf="showToggle()" class="mb-6 flex items-center gap-3 p-3 rounded-lg border border-divider/50 bg-base-200/30">
            <div class="relative inline-flex items-center cursor-pointer group">
                <input type="checkbox" [checked]="toggleValue()" (change)="onToggleChange($event)" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent cursor-pointer"></div>
            </div>
            <span class="text-sm font-medium text-primary cursor-pointer select-none" (click)="manualToggle()">{{ toggleLabel() }}</span>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button (click)="close()" class="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-hover transition-colors">
            {{ cancelText() }}
          </button>
          <button (click)="confirm()" class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-accent hover:bg-accent-dark shadow-lg hover:shadow-accent/40 active:scale-95 transition-all">
            {{ confirmText() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class ConfirmationModalComponent {
  isOpen = signal(false);

  title = signal('Confirm Action');
  message = signal('Are you sure you want to proceed?');
  comment = signal(''); // Optional comment

  // Toggle support
  showToggle = signal(false);
  toggleLabel = signal('Option');
  toggleLabelOn = signal('');
  toggleLabelOff = signal('');
  toggleValue = signal(false);

  confirmText = signal('Accept');
  cancelText = signal('Close');

  @Output() onConfirm = new EventEmitter<{ toggleValue: boolean }>();
  @Output() onCancel = new EventEmitter<void>();

  open(config: {
    title?: string,
    message?: string,
    comment?: string,
    showToggle?: boolean,
    toggleLabel?: string,
    toggleLabelOn?: string,
    toggleLabelOff?: string,
    toggleValue?: boolean
    confirmText?: string,
    cancelText?: string
  }) {
    if (config.title) this.title.set(config.title);
    if (config.message) this.message.set(config.message);
    if (config.comment) this.comment.set(config.comment);
    if (config.showToggle !== undefined) this.showToggle.set(config.showToggle);
    if (config.toggleLabel) this.toggleLabel.set(config.toggleLabel);
    if (config.toggleLabelOn) this.toggleLabelOn.set(config.toggleLabelOn);
    if (config.toggleLabelOff) this.toggleLabelOff.set(config.toggleLabelOff);
    if (config.toggleValue !== undefined) {
      this.toggleValue.set(config.toggleValue);
      this.updateToggleLabel();
    }
    if (config.confirmText) this.confirmText.set(config.confirmText);
    if (config.cancelText) this.cancelText.set(config.cancelText);

    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.onCancel.emit();
  }

  confirm() {
    this.isOpen.set(false);
    this.onConfirm.emit({ toggleValue: this.toggleValue() });
  }

  onToggleChange(event: any) {
    this.toggleValue.set(event.target.checked);
    this.updateToggleLabel();
  }

  manualToggle() {
    this.toggleValue.set(!this.toggleValue());
    this.updateToggleLabel();
  }

  private updateToggleLabel() {
    if (this.toggleValue() && this.toggleLabelOn()) {
      this.toggleLabel.set(this.toggleLabelOn());
    } else if (!this.toggleValue() && this.toggleLabelOff()) {
      this.toggleLabel.set(this.toggleLabelOff());
    }
  }
}

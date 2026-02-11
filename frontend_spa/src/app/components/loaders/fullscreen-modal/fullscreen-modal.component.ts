import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-fullscreen-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="fixed inset-0 z-[9999] bg-base flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out"
        [class.opacity-0]="!isLoading()" [class.pointer-events-none]="!isLoading()">
        <div class="flex flex-col items-center gap-6">
            <div class="w-40 h-40 animate-fade-pulse">
                <img src="/favicon.svg" alt="Loading" class="w-full h-full">
            </div>
            <div class="text-2xl font-bold text-primary tracking-widest animate-pulse font-brand">MNEMOS</div>
        </div>
    </div>
  `,
    styles: [`
    @keyframes fade-pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }

    .animate-fade-pulse {
      animation: fade-pulse 2s ease-in-out infinite;
    }
  `]
})
export class FullscreenModalComponent {
    isLoading = input.required<boolean>();
}

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fullscreen-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[9999] bg-base flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out bg-center"
        [style.backgroundImage]="'url(/mnemosyne-w.gif)'"
        [style.backgroundSize]="'auto'"
        [class.opacity-0]="!isLoading()" [class.pointer-events-none]="!isLoading()">
        <div class="flex flex-col items-center gap-6 z-10">
            <div class="w-40 h-40 animate-fade-pulse">
                <img src="/favicon.svg" alt="Loading" class="w-full h-full drop-shadow-2xl">
            </div>
            <h1 class="text-4xl sm:text-5xl font-bold text-primary animate-pulse font-brand drop-shadow-lg">MNEMOS</h1>
        </div>
        <div class="absolute inset-0 bg-base/90 z-0 backdrop-blur-sm"></div> <!-- Overlay to ensure text readability -->
    </div>
  `,
  styles: [`
    @keyframes fade-pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
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

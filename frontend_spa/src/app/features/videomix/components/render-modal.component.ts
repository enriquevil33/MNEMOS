import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoMixService } from '@services/videomix.service';
import { VideoMixScript, VideoMixRenderJob } from '@core/models/videomix.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-render-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="onBackdropClick($event)">
      <div class="bg-panel rounded-lg shadow-xl max-w-md w-full" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-primary">Render Video</h2>
          <button (click)="close.emit()" class="p-2 hover:bg-hover rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6">
          @if (script) {
            <div class="space-y-4">
              <!-- Script Info -->
              <div class="bg-background rounded-lg p-4 border border-border">
                <h3 class="text-sm font-medium text-primary mb-2">Script Summary</h3>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-secondary">Version:</span>
                    <span class="text-primary font-medium">{{ script.version }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-secondary">Segments:</span>
                    <span class="text-primary font-medium">{{ script.segment_count }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-secondary">Total Duration:</span>
                    <span class="text-primary font-medium">{{ formatDuration(script.total_duration) }}</span>
                  </div>
                </div>
              </div>

              <!-- Warning -->
              <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div class="flex gap-3">
                  <svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-yellow-500">Rendering may take several minutes</p>
                    <p class="text-xs text-secondary mt-1">
                      The video will be processed in the background. You'll be notified when it's ready.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Info -->
              <div class="text-xs text-secondary">
                <p>The video will be rendered with the following settings:</p>
                <ul class="list-disc list-inside mt-2 space-y-1 ml-2">
                  <li>Resolution: {{ project?.resolution || 'Source' }}</li>
                  <li>Audio Normalization: {{ project?.audio_normalization ? 'Enabled' : 'Disabled' }}</li>
                  <li>Title Cards: {{ project?.title_cards_enabled ? 'Enabled' : 'Disabled' }}</li>
                </ul>
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            (click)="close.emit()"
            [disabled]="isRendering()"
            class="px-4 py-2 text-sm font-medium text-secondary hover:bg-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button
            (click)="startRender()"
            [disabled]="isRendering()"
            class="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            @if (isRendering()) {
              <span class="flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting Render...
              </span>
            } @else {
              Start Render
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class RenderModalComponent {
  @Input() script: VideoMixScript | null = null;
  @Input() project: any = null; // VideoMixProject
  @Output() close = new EventEmitter<void>();
  @Output() renderStarted = new EventEmitter<VideoMixRenderJob>();

  private videoMixService = inject(VideoMixService);
  private toastr = inject(ToastrService);

  isRendering = signal<boolean>(false);

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isRendering()) {
      this.close.emit();
    }
  }

  async startRender(): Promise<void> {
    if (!this.script || this.isRendering()) return;

    this.isRendering.set(true);

    try {
      const job = await this.videoMixService.renderScript(this.script.id);
      this.toastr.success('Render started! You can track progress below.');
      this.renderStarted.emit(job);
      this.close.emit();
    } catch (error) {
      console.error('Failed to start render:', error);
      this.toastr.error('Failed to start render. Please try again.');
      this.isRendering.set(false);
    }
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

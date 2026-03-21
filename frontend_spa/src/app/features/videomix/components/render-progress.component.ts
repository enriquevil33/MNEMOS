import { Component, Input, inject, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoMixService } from '@services/videomix.service';
import { VideoMixRenderJob } from '@core/models/videomix.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-render-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (currentJob()) {
      <div class="bg-panel border border-border rounded-lg p-4">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="text-sm font-medium text-primary">Rendering Video</h3>
            <p class="text-xs text-secondary mt-1">
              @if (currentJob()!.status === 'pending') {
                Waiting to start...
              } @else if (currentJob()!.status === 'processing') {
                Processing video segments...
              } @else if (currentJob()!.status === 'completed') {
                Render completed successfully!
              } @else if (currentJob()!.status === 'error') {
                Render failed
              }
            </p>
          </div>

          <!-- Status Badge -->
          <span [class]="getStatusClasses(currentJob()!.status)">
            {{ getStatusLabel(currentJob()!.status) }}
          </span>
        </div>

        <!-- Progress Bar -->
        @if (currentJob()!.status === 'processing' || currentJob()!.status === 'pending') {
          <div class="mb-3">
            <div class="flex items-center justify-between text-xs text-secondary mb-1">
              <span>Progress</span>
              <span>{{ currentJob()!.progress_percentage }}%</span>
            </div>
            <div class="w-full bg-background rounded-full h-2 overflow-hidden">
              <div
                class="bg-accent h-full transition-all duration-300 ease-out"
                [style.width.%]="currentJob()!.progress_percentage">
              </div>
            </div>
          </div>
        }

        <!-- Error Message -->
        @if (currentJob()!.status === 'error' && currentJob()!.error_message) {
          <div class="bg-red-500/10 border border-red-500/20 rounded p-3 mb-3">
            <p class="text-sm text-red-500">{{ currentJob()!.error_message }}</p>
          </div>
        }

        <!-- Actions -->
        <div class="flex items-center gap-2">
          @if (currentJob()!.status === 'completed') {
            <button
              (click)="downloadVideo()"
              class="flex-1 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Video
              @if (currentJob()!.output_size_bytes) {
                <span class="text-xs opacity-75">({{ formatFileSize(currentJob()!.output_size_bytes!) }})</span>
              }
            </button>
          }

          @if (currentJob()!.status === 'error') {
            <button
              (click)="retryRender()"
              class="flex-1 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium">
              Retry Render
            </button>
          }

          @if (currentJob()!.status === 'processing') {
            <button
              (click)="refreshStatus()"
              [disabled]="isRefreshing()"
              class="px-3 py-2 text-sm text-secondary hover:bg-hover rounded-lg transition-colors disabled:opacity-50">
              <svg class="w-4 h-4" [class.animate-spin]="isRefreshing()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: []
})
export class RenderProgressComponent implements OnDestroy {
  @Input() set jobId(value: string | null) {
    if (value) {
      this.loadJob(value);
    }
  }

  private videoMixService = inject(VideoMixService);
  private toastr = inject(ToastrService);

  currentJob = signal<VideoMixRenderJob | null>(null);
  isRefreshing = signal<boolean>(false);
  private pollingInterval: any = null;

  constructor() {
    // Auto-refresh when job is processing
    effect(() => {
      const job = this.currentJob();
      if (job && (job.status === 'processing' || job.status === 'pending')) {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async loadJob(jobId: string): Promise<void> {
    try {
      const job = await this.videoMixService.getRenderJobStatus(jobId);
      this.currentJob.set(job);
    } catch (error) {
      console.error('Failed to load render job:', error);
    }
  }

  async refreshStatus(): Promise<void> {
    const job = this.currentJob();
    if (!job) return;

    this.isRefreshing.set(true);
    try {
      const updated = await this.videoMixService.getRenderJobStatus(job.id);
      this.currentJob.set(updated);

      if (updated.status === 'completed') {
        this.toastr.success('Video render completed!');
      } else if (updated.status === 'error') {
        this.toastr.error('Video render failed');
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      this.isRefreshing.set(false);
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return;

    // Poll every 3 seconds
    this.pollingInterval = setInterval(() => {
      this.refreshStatus();
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  downloadVideo(): void {
    const job = this.currentJob();
    if (!job || job.status !== 'completed') return;

    const downloadUrl = this.videoMixService.getDownloadUrl(job.id);
    window.open(downloadUrl, '_blank');
  }

  retryRender(): void {
    // Emit event or call parent to retry
    this.toastr.info('Please start a new render from the project page');
  }

  getStatusClasses(status: string): string {
    const base = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'pending':
        return `${base} bg-gray-500/10 text-gray-500`;
      case 'processing':
        return `${base} bg-blue-500/10 text-blue-500`;
      case 'completed':
        return `${base} bg-green-500/10 text-green-500`;
      case 'error':
        return `${base} bg-red-500/10 text-red-500`;
      default:
        return `${base} bg-gray-500/10 text-gray-500`;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'error': return 'Failed';
      default: return status;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

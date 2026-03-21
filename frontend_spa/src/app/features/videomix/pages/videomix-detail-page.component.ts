import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VideoMixService } from '@services/videomix.service';
import { VideoMixProject, VideoMixScript, VideoMixRenderJob } from '@core/models/videomix.model';
import { AppRoutes } from '@core/constants/app-routes';
import { VideoMixTimelineComponent } from '../components/videomix-timeline.component';
import { VideoMixChatComponent } from '../components/videomix-chat.component';
import { RenderModalComponent } from '../components/render-modal.component';
import { RenderProgressComponent } from '../components/render-progress.component';

@Component({
  selector: 'app-videomix-detail-page',
  standalone: true,
  imports: [CommonModule, VideoMixTimelineComponent, VideoMixChatComponent, RenderModalComponent, RenderProgressComponent],
  template: `
    <div class="h-full flex flex-col bg-background">
      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <svg class="animate-spin h-12 w-12 mx-auto mb-4 text-accent" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-lg text-primary">Loading project...</p>
          </div>
        </div>
      } @else if (error()) {
        <div class="flex items-center justify-center h-full">
          <div class="text-center max-w-md">
            <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-medium text-primary mb-2">Error Loading Project</h3>
            <p class="text-sm text-secondary mb-4">{{ error() }}</p>
            <button
              (click)="goBack()"
              class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
              Back to Projects
            </button>
          </div>
        </div>
      } @else {
        <!-- Main Content -->
        <div class="h-full flex flex-col">
          <!-- Header -->
          <div class="flex-shrink-0 border-b border-border bg-panel p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              (click)="goBack()"
              class="p-2 hover:bg-hover rounded-lg transition-colors"
              title="Back to projects">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-xl font-semibold text-primary">{{ project()?.title || 'Loading...' }}</h1>
              @if (project()) {
                <p class="text-sm text-secondary mt-1">{{ project()!.user_prompt }}</p>
              }
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Status Badge -->
            @if (project()) {
              <span [class]="getStatusClasses(project()!.status)">
                {{ getStatusLabel(project()!.status) }}
              </span>
            }

            <!-- Generate Script Button -->
            @if (project() && project()!.status === 'draft') {
              <button
                (click)="generateScript()"
                [disabled]="videoMixService.isGeneratingScript()"
                class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                @if (videoMixService.isGeneratingScript()) {
                  <span class="flex items-center gap-2">
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                } @else {
                  Generate Script
                }
              </button>
            }

            <!-- Render Button / Cancel Button / Retry Button -->
            @if (project() && videoMixService.currentScript()) {
              @if (project()!.status === 'rendering' && currentRenderJob()) {
                <button
                  (click)="cancelRender()"
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel Render
                </button>
              } @else if (project()!.status === 'error') {
                <button
                  (click)="retryRender()"
                  class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Render
                </button>
              } @else if (project()!.status === 'script_ready' || project()!.status === 'completed') {
                <button
                  (click)="showRenderModal.set(true)"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Render Video
                </button>
              }
            }

            <!-- Download Button (for completed renders) -->
            @if (project() && completedRenderJob()) {
              <a
                [href]="getDownloadUrl()"
                download
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Video
              </a>
            }
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-hidden flex">
        <!-- Left: Timeline/Script Preview (2/3 width) -->
        <div class="flex-[2] border-r border-border overflow-y-auto">
          @if (videoMixService.isGeneratingScript()) {
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <svg class="animate-spin h-12 w-12 mx-auto mb-4 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-lg text-primary">Generating script...</p>
                <p class="text-sm text-secondary mt-2">The AI is analyzing your videos and creating a script</p>
              </div>
            </div>
          } @else if (videoMixService.currentScript()) {
            <app-videomix-timeline [script]="videoMixService.currentScript()" />
          } @else {
            <div class="flex items-center justify-center h-full">
              <div class="text-center max-w-md">
                <svg class="w-24 h-24 mx-auto mb-4 text-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                <h3 class="text-lg font-medium text-primary mb-2">No Script Yet</h3>
                <p class="text-secondary">Click "Generate Script" to have the AI create a video script from your selected documents.</p>
              </div>
            </div>
          }
        </div>

        <!-- Right: Chat Interface (1/3 width) -->
        <div class="flex-[1] bg-panel">
          @if (videoMixService.currentScript()) {
            <app-videomix-chat [projectId]="project()?.id || null" />
          } @else {
            <div class="h-full flex items-center justify-center p-4">
              <p class="text-sm text-secondary text-center">Generate a script to start refining it with AI</p>
            </div>
          }
          </div>
        </div>

        <!-- Render Progress (if active) -->
        @if (currentRenderJob()) {
          <div class="absolute bottom-4 right-4 w-96 z-10">
            <app-render-progress [jobId]="currentRenderJob()!.id" />
          </div>
        }

        <!-- Render Modal -->
        @if (showRenderModal()) {
          <app-render-modal
            [script]="videoMixService.currentScript()"
            [project]="project()"
            (close)="showRenderModal.set(false)"
            (renderStarted)="onRenderStarted($event)">
          </app-render-modal>
        }

        <!-- Cancel Confirmation Modal -->
        @if (showCancelConfirm()) {
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-panel border border-border rounded-lg p-6 max-w-md w-full mx-4">
              <h3 class="text-lg font-semibold text-primary mb-2">Cancel Render?</h3>
              <p class="text-sm text-secondary mb-6">
                Are you sure you want to cancel the current render? This action cannot be undone.
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  (click)="showCancelConfirm.set(false)"
                  class="px-4 py-2 bg-hover text-primary rounded-lg hover:bg-hover/80 transition-colors">
                  No, Continue Rendering
                </button>
                <button
                  (click)="confirmCancel()"
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                  Yes, Cancel Render
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
    </div>
  `,
  styles: []
})
export class VideoMixDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public videoMixService = inject(VideoMixService);

  project = signal<VideoMixProject | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  showRenderModal = signal<boolean>(false);
  showCancelConfirm = signal<boolean>(false);
  currentRenderJob = signal<VideoMixRenderJob | null>(null);
  completedRenderJob = signal<VideoMixRenderJob | null>(null);

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      this.loadProject(projectId);
    } else {
      this.goBack();
    }
  }

  async loadProject(id: string): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      const project = await this.videoMixService.getProject(id);
      this.project.set(project);

      // Check for active render job
      if (project.render_jobs && project.render_jobs.length > 0) {
        const activeJob = project.render_jobs.find(job =>
          job.status === 'pending' || job.status === 'processing'
        );
        if (activeJob) {
          this.currentRenderJob.set(activeJob);
        }

        // Check for completed render job
        const completedJob = project.render_jobs.find(job =>
          job.status === 'completed'
        );
        if (completedJob) {
          this.completedRenderJob.set(completedJob);
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      this.error.set('Failed to load project');
    } finally {
      this.isLoading.set(false);
    }
  }

  async generateScript(): Promise<void> {
    const proj = this.project();
    if (!proj) return;

    try {
      await this.videoMixService.generateScript(proj.id);
      // Project and script are automatically updated in the service
    } catch (err) {
      console.error('Failed to generate script:', err);
      this.error.set('Failed to generate script');
    }
  }

  onRenderStarted(job: VideoMixRenderJob): void {
    this.currentRenderJob.set(job);
  }

  cancelRender(): void {
    this.showCancelConfirm.set(true);
  }

  async confirmCancel(): Promise<void> {
    const job = this.currentRenderJob();
    const proj = this.project();

    if (!job || !proj) return;

    try {
      this.showCancelConfirm.set(false);

      // Cancel the render job via API (will revoke Celery task)
      await this.videoMixService.cancelRenderJob(job.id);

      // Clear the current job
      this.currentRenderJob.set(null);

      // Reload project to get fresh state
      await this.loadProject(proj.id);

    } catch (err) {
      console.error('Failed to cancel render:', err);
      this.error.set('Failed to cancel render');
    }
  }

  retryRender(): void {
    // Simply open the render modal to start a new render
    this.showRenderModal.set(true);
  }

  getDownloadUrl(): string {
    const job = this.completedRenderJob();
    return job ? this.videoMixService.getDownloadUrl(job.id) : '';
  }

  goBack(): void {
    this.router.navigate(['/', AppRoutes.VIDEOMIX]);
  }

  getStatusClasses(status: string): string {
    const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'draft':
        return `${baseClasses} bg-gray-500/10 text-gray-500`;
      case 'generating_script':
        return `${baseClasses} bg-blue-500/10 text-blue-500`;
      case 'script_ready':
        return `${baseClasses} bg-green-500/10 text-green-500`;
      case 'rendering':
        return `${baseClasses} bg-yellow-500/10 text-yellow-500`;
      case 'completed':
        return `${baseClasses} bg-emerald-500/10 text-emerald-500`;
      case 'error':
        return `${baseClasses} bg-red-500/10 text-red-500`;
      default:
        return `${baseClasses} bg-gray-500/10 text-gray-500`;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'draft': return 'Draft';
      case 'generating_script': return 'Generating Script';
      case 'script_ready': return 'Script Ready';
      case 'rendering': return 'Rendering';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return status;
    }
  }
}

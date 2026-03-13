import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VideoMixService } from '@services/videomix.service';
import { DocumentsService } from '@services/documents.service';
import { ToastrService } from 'ngx-toastr';
import { VideoMixProject } from '@core/models/videomix.model';
import { CreateProjectModalComponent } from '../components/create-project-modal.component';

@Component({
  selector: 'app-videomix-page',
  standalone: true,
  imports: [CommonModule, CreateProjectModalComponent],
  template: `
    <div class="container mx-auto p-4 h-full flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Video Mix Studio</h1>
        <button
          (click)="showCreateModal()"
          class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
          Create New Mix
        </button>
      </div>

      @if (videoMixService.projects().length === 0) {
        <!-- Empty State -->
        <div class="flex flex-col items-center justify-center flex-grow text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-20 h-20 text-secondary mb-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
          </svg>
          <h2 class="text-xl font-semibold mb-2">No video mixes yet</h2>
          <p class="text-secondary mb-6 max-w-md">
            Create your first AI-curated video mix by selecting videos from your library and describing what you want to create.
          </p>
          <button
            (click)="showCreateModal()"
            class="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
            Create Your First Mix
          </button>
        </div>
      } @else {
        <!-- Projects Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-grow content-start">
          @for (project of videoMixService.projects(); track project.id) {
            <div
              class="bg-panel rounded-lg shadow-sm border border-divider hover:shadow-md hover:bg-base-200/50 transition-all cursor-pointer flex flex-col"
              (click)="openProject(project.id)">

              <!-- Status Badge -->
              <div class="flex justify-between items-start p-4">
                <span class="px-2 py-1 text-xs font-medium rounded-full"
                      [class]="getStatusClass(project.status)">
                  {{ getStatusLabel(project.status) }}
                </span>

                <!-- Delete Button -->
                <button
                  (click)="deleteProject($event, project.id)"
                  class="p-1 hover:bg-error/10 hover:text-error rounded transition-colors"
                  title="Delete project">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>

              <!-- Project Info -->
              <div class="px-4 pb-2 flex-grow">
                <h2 class="text-lg font-semibold mb-2 line-clamp-1" [title]="project.title">
                  {{ project.title }}
                </h2>

                @if (project.description) {
                  <p class="text-sm text-secondary line-clamp-2 mb-2">
                    {{ project.description }}
                  </p>
                }

                <p class="text-xs text-secondary line-clamp-2">
                  {{ project.user_prompt }}
                </p>
              </div>

              <!-- Footer -->
              <div class="flex items-center justify-between text-xs text-secondary mt-auto py-2 px-4 border-t border-divider">
                <span>{{ project.created_at | date:'mediumDate' }}</span>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-hover rounded-full">
                    {{ project.document_ids.length }} videos
                  </span>
                  @if (project.scripts && project.scripts.length > 0) {
                    <span class="px-2 py-0.5 bg-hover rounded-full">
                      v{{ project.scripts[0].version }}
                    </span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Create Modal -->
      @if (showModal()) {
        <app-create-project-modal
          (close)="showModal.set(false)"
          (created)="onProjectCreated($event)">
        </app-create-project-modal>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class VideoMixPageComponent implements OnInit {
  videoMixService = inject(VideoMixService);
  documentsService = inject(DocumentsService);
  router = inject(Router);
  toastr = inject(ToastrService);

  showModal = signal<boolean>(false);

  ngOnInit() {
    this.videoMixService.fetchProjects();
    this.documentsService.fetchDocuments();
  }

  showCreateModal() {
    this.showModal.set(true);
  }

  onProjectCreated(projectId: string) {
    this.router.navigate(['/videoMix', projectId]);
  }

  openProject(projectId: string) {
    this.router.navigate(['/videoMix', projectId]);
  }

  async deleteProject(event: Event, projectId: string) {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this project? This will also delete any rendered videos.')) {
      return;
    }

    try {
      await this.videoMixService.deleteProject(projectId);
      this.toastr.success('Project deleted successfully');
    } catch (error) {
      this.toastr.error('Failed to delete project');
      console.error('Delete error:', error);
    }
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'draft': 'bg-base-300 text-secondary',
      'generating_script': 'bg-info/20 text-info',
      'script_ready': 'bg-success/20 text-success',
      'rendering': 'bg-warning/20 text-warning',
      'completed': 'bg-success/20 text-success',
      'error': 'bg-error/20 text-error'
    };
    return classes[status] || 'bg-base-300 text-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'generating_script': 'Generating...',
      'script_ready': 'Ready',
      'rendering': 'Rendering...',
      'completed': 'Completed',
      'error': 'Error'
    };
    return labels[status] || status;
  }
}

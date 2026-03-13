import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiEndpoints } from '@core/constants/api-endpoints';
import {
  VideoMixProject,
  VideoMixScript,
  VideoMixRenderJob,
  CreateVideoMixProjectRequest,
  RefineScriptRequest
} from '@core/models/videomix.model';

@Injectable({
  providedIn: 'root'
})
export class VideoMixService {
  private http = inject(HttpClient);

  // State
  projects = signal<VideoMixProject[]>([]);
  currentProject = signal<VideoMixProject | null>(null);
  currentScript = signal<VideoMixScript | null>(null);
  isGeneratingScript = signal<boolean>(false);
  isRendering = signal<boolean>(false);

  /**
   * Fetch all video mix projects
   */
  async fetchProjects(): Promise<void> {
    try {
      const projects = await firstValueFrom(
        this.http.get<VideoMixProject[]>(ApiEndpoints.VIDEOMIX_PROJECTS)
      );
      this.projects.set(projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      throw error;
    }
  }

  /**
   * Create a new video mix project
   */
  async createProject(data: CreateVideoMixProjectRequest): Promise<VideoMixProject> {
    try {
      const project = await firstValueFrom(
        this.http.post<VideoMixProject>(ApiEndpoints.VIDEOMIX_PROJECTS, data)
      );
      this.projects.update(p => [project, ...p]);
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Get project details including scripts and render jobs
   */
  async getProject(id: string): Promise<VideoMixProject> {
    try {
      const project = await firstValueFrom(
        this.http.get<VideoMixProject>(ApiEndpoints.VIDEOMIX_PROJECT(id))
      );
      this.currentProject.set(project);

      // Set current script to latest non-empty version
      if (project.scripts && project.scripts.length > 0) {
        // Find first script with segments
        const validScript = project.scripts.find(s => s.segments && s.segments.length > 0);
        this.currentScript.set(validScript || project.scripts[0]);
      }

      return project;
    } catch (error) {
      console.error('Failed to get project:', error);
      throw error;
    }
  }

  /**
   * Update project settings
   */
  async updateProject(id: string, data: Partial<VideoMixProject>): Promise<VideoMixProject> {
    try {
      const project = await firstValueFrom(
        this.http.put<VideoMixProject>(ApiEndpoints.VIDEOMIX_PROJECT(id), data)
      );
      this.currentProject.set(project);

      // Update in projects list
      this.projects.update(projects =>
        projects.map(p => p.id === id ? project : p)
      );

      return project;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(ApiEndpoints.VIDEOMIX_PROJECT_DELETE(id))
      );
      this.projects.update(p => p.filter(proj => proj.id !== id));

      if (this.currentProject()?.id === id) {
        this.currentProject.set(null);
        this.currentScript.set(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Generate initial script for project
   */
  async generateScript(projectId: string): Promise<VideoMixScript> {
    try {
      this.isGeneratingScript.set(true);
      const script = await firstValueFrom(
        this.http.post<VideoMixScript>(
          ApiEndpoints.VIDEOMIX_GENERATE_SCRIPT(projectId),
          {}
        )
      );
      this.currentScript.set(script);

      // Refresh project to get updated status
      await this.getProject(projectId);

      return script;
    } catch (error) {
      console.error('Failed to generate script:', error);
      throw error;
    } finally {
      this.isGeneratingScript.set(false);
    }
  }

  /**
   * Refine script with user feedback
   */
  async refineScript(projectId: string, message: string): Promise<VideoMixScript> {
    try {
      this.isGeneratingScript.set(true);
      const body: RefineScriptRequest = { message };
      const script = await firstValueFrom(
        this.http.post<VideoMixScript>(
          ApiEndpoints.VIDEOMIX_REFINE_SCRIPT(projectId),
          body
        )
      );
      this.currentScript.set(script);

      // Refresh project
      await this.getProject(projectId);

      return script;
    } catch (error) {
      console.error('Failed to refine script:', error);
      throw error;
    } finally {
      this.isGeneratingScript.set(false);
    }
  }

  /**
   * Start rendering a script
   */
  async renderScript(scriptId: string): Promise<VideoMixRenderJob> {
    try {
      this.isRendering.set(true);
      const job = await firstValueFrom(
        this.http.post<VideoMixRenderJob>(
          ApiEndpoints.VIDEOMIX_RENDER_SCRIPT(scriptId),
          {}
        )
      );
      return job;
    } catch (error) {
      console.error('Failed to start render:', error);
      this.isRendering.set(false);
      throw error;
    }
  }

  /**
   * Get render job status
   */
  async getRenderJobStatus(jobId: string): Promise<VideoMixRenderJob> {
    try {
      const job = await firstValueFrom(
        this.http.get<VideoMixRenderJob>(ApiEndpoints.VIDEOMIX_RENDER_JOB(jobId))
      );

      // Update rendering state based on job status
      if (job.status === 'completed' || job.status === 'error') {
        this.isRendering.set(false);
      }

      return job;
    } catch (error) {
      console.error('Failed to get render job status:', error);
      throw error;
    }
  }

  /**
   * Cancel a render job
   */
  async cancelRenderJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(ApiEndpoints.VIDEOMIX_CANCEL_RENDER(jobId), {})
      );
      this.isRendering.set(false);
    } catch (error) {
      console.error('Failed to cancel render job:', error);
      throw error;
    }
  }

  /**
   * Get download URL for completed render
   */
  getDownloadUrl(jobId: string): string {
    return ApiEndpoints.VIDEOMIX_DOWNLOAD(jobId);
  }

  /**
   * Reset current project and script
   */
  resetCurrent(): void {
    this.currentProject.set(null);
    this.currentScript.set(null);
    this.isGeneratingScript.set(false);
    this.isRendering.set(false);
  }
}

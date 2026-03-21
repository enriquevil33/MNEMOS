export interface VideoMixProject {
  id: string;
  title: string;
  description?: string;
  user_prompt: string;
  document_ids: string[];
  resolution: '1080p' | '720p' | '480p' | 'source';
  title_cards_enabled: boolean;
  max_duration_seconds?: number;
  audio_normalization: boolean;
  status: 'draft' | 'generating_script' | 'script_ready' | 'rendering' | 'completed' | 'error';
  error_message?: string;
  created_at: string;
  updated_at?: string;
  scripts?: VideoMixScript[];
  render_jobs?: VideoMixRenderJob[];
}

export interface VideoMixScript {
  id: string;
  project_id: string;
  version: number;
  script_data: {
    segments: ScriptSegment[];
    total_duration: number;
    llm_reasoning: string;
    reflection_history?: any[];
  };
  segments?: ScriptSegment[];  // Flattened for easier access
  total_duration: number;
  segment_count: number;
  llm_reasoning?: string;  // Alias for ai_reasoning
  ai_reasoning?: string;   // For chat component
  created_at: string;
}

export interface ScriptSegment {
  type: 'video' | 'title_card';
  duration?: number;  // May be calculated from start_time and end_time
  start_time?: number;
  end_time?: number;
  order?: number;
  title?: string;
  description?: string;
  source_file?: string;
  source_start?: number;
  source_end?: number;
  text?: string;
  chunk_id?: string;
  document_id?: string;
}

export interface VideoSegment {
  chunk_id: string;
  document_id: string;
  start_time: number;
  end_time: number;
  title: string;
  description: string;
  order: number;
  title_card?: {
    enabled: boolean;
    text: string;
    duration: number;
  };
}

export interface VideoMixRenderJob {
  id: string;
  project_id: string;
  script_id: string;
  celery_task_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress_percentage: number;
  error_message?: string;
  output_filename?: string;
  output_size_bytes?: number;
  created_at: string;
  completed_at?: string;
}

export interface CreateVideoMixProjectRequest {
  title: string;
  description?: string;
  user_prompt: string;
  document_ids: string[];
  resolution?: '1080p' | '720p' | '480p' | 'source';
  title_cards_enabled?: boolean;
  max_duration_seconds?: number;
  audio_normalization?: boolean;
}

export interface RefineScriptRequest {
  message: string;
}

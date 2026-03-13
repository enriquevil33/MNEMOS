import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoMixScript } from '@core/models/videomix.model';

interface TimelineSegment {
  type: 'video' | 'title_card';
  startTime: number;
  endTime: number;
  duration: number;
  title?: string;
  sourceFile?: string;
  sourceStart?: number;
  sourceEnd?: number;
  text?: string;
}

@Component({
  selector: 'app-videomix-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header with Stats -->
      <div class="flex-shrink-0 p-4 bg-panel border-b border-border">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-primary">Script Timeline</h2>
          @if (_script()) {
            <span class="text-sm text-secondary">
              Version {{ _script()!.version }}
            </span>
          }
        </div>

        <!-- Stats -->
        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-secondary">
              Total: <span class="text-primary font-medium">{{ formatDuration(totalDuration()) }}</span>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <span class="text-secondary">
              Segments: <span class="text-primary font-medium">{{ segments().length }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        @if (segments().length === 0) {
          <div class="flex items-center justify-center h-full">
            <p class="text-secondary">No segments in this script</p>
          </div>
        } @else {
          @for (segment of segments(); track $index) {
            <div class="group relative">
              <!-- Timeline Track with Duration Bar -->
              <div class="flex gap-3">
                <!-- Segment Number -->
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-medium">
                  {{ $index + 1 }}
                </div>

                <!-- Segment Card -->
                <div class="flex-1 bg-hover/50 rounded-lg border border-border hover:border-accent/50 hover:bg-hover transition-all">
                  <div class="p-3">
                    <!-- Type Badge and Duration -->
                    <div class="flex items-center justify-between mb-2">
                      <span
                        [class]="segment.type === 'title_card' ? 'px-2 py-0.5 text-xs font-medium rounded bg-blue-500/10 text-blue-500' : 'px-2 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-500'">
                        {{ segment.type === 'title_card' ? 'Title Card' : 'Video Clip' }}
                      </span>
                      <span class="text-xs text-secondary font-mono">
                        {{ formatDuration(segment.duration) }}
                      </span>
                    </div>

                    <!-- Content -->
                    @if (segment.type === 'title_card') {
                      <p class="text-sm text-primary font-medium">{{ segment.text }}</p>
                    } @else {
                      <div class="space-y-1">
                        @if (segment.title) {
                          <p class="text-sm text-primary font-medium">{{ segment.title }}</p>
                        }
                        @if (segment.sourceFile) {
                          <p class="text-xs text-secondary">
                            Source: <span class="font-mono">{{ getFileName(segment.sourceFile) }}</span>
                          </p>
                        }
                        @if (segment.sourceStart !== undefined && segment.sourceEnd !== undefined) {
                          <p class="text-xs text-secondary font-mono">
                            {{ formatTimestamp(segment.sourceStart) }} → {{ formatTimestamp(segment.sourceEnd) }}
                          </p>
                        }
                      </div>
                    }
                  </div>

                  <!-- Progress Bar showing position in timeline -->
                  <div class="h-1 bg-background">
                    <div
                      class="h-full bg-accent/30"
                      [style.width.%]="getSegmentProgress(segment)">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Timeline Connector (except for last item) -->
              @if ($index < segments().length - 1) {
                <div class="ml-4 h-4 border-l-2 border-border border-dashed"></div>
              }
            </div>
          }
        }
      </div>

      <!-- AI Reasoning (if available) -->
      @if (_script() && _script()!.ai_reasoning) {
        <div class="flex-shrink-0 border-t border-border p-4 bg-panel/50">
          <details class="text-sm">
            <summary class="cursor-pointer text-secondary hover:text-primary flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>AI Reasoning</span>
            </summary>
            <p class="mt-2 text-secondary whitespace-pre-wrap pl-6">{{ _script()!.ai_reasoning }}</p>
          </details>
        </div>
      }
    </div>
  `,
  styles: []
})
export class VideoMixTimelineComponent {
  @Input() set script(value: VideoMixScript | null) {
    this._script.set(value);
  }

  protected _script = signal<VideoMixScript | null>(null);

  segments = computed<TimelineSegment[]>(() => {
    const s = this._script();
    if (!s || !s.segments) return [];

    let currentTime = 0;
    return s.segments.map(seg => {
      // Calculate duration from start_time and end_time if duration field is not present
      const duration = seg.duration ?? (seg.end_time ?? 0) - (seg.start_time ?? 0);

      const segment: TimelineSegment = {
        type: seg.type as 'video' | 'title_card',
        startTime: currentTime,
        endTime: currentTime + duration,
        duration: duration,
        title: seg.title,
        sourceFile: seg.source_file,
        sourceStart: seg.source_start ?? seg.start_time,
        sourceEnd: seg.source_end ?? seg.end_time,
        text: seg.text
      };
      currentTime += duration;
      return segment;
    });
  });

  totalDuration = computed(() => {
    const segs = this.segments();
    if (segs.length === 0) return 0;
    return segs[segs.length - 1].endTime;
  });

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getFileName(path: string): string {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  getSegmentProgress(segment: TimelineSegment): number {
    const total = this.totalDuration();
    if (total === 0) return 0;
    return (segment.endTime / total) * 100;
  }
}

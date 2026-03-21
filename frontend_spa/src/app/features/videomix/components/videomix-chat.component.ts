import { Component, Input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VideoMixService } from '@services/videomix.service';
import { MarkdownDisplayComponent } from '@components/markdown/markdown-display.component';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-videomix-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownDisplayComponent],
  template: `
    <div class="h-full flex flex-col bg-panel">
      <!-- Header -->
      <div class="flex-shrink-0 p-4 border-b border-border">
        <h2 class="text-lg font-semibold text-primary">Refine Script</h2>
        <p class="text-sm text-secondary mt-1">Chat with the AI to adjust the script</p>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4" #messagesContainer>
        @if (messages().length === 0) {
          <div class="flex items-center justify-center h-full">
            <div class="text-center max-w-sm">
              <svg class="w-16 h-16 mx-auto mb-4 text-secondary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p class="text-sm text-secondary">
                Ask the AI to make changes to the script, like:
              </p>
              <ul class="text-xs text-secondary mt-3 space-y-1 text-left">
                <li>• "Make it shorter, around 2 minutes"</li>
                <li>• "Add more emphasis on topic X"</li>
                <li>• "Remove the segment about Y"</li>
                <li>• "Add a title card at the beginning"</li>
              </ul>
            </div>
          </div>
        } @else {
          @for (msg of messages(); track $index) {
            <div class="flex flex-col"
                 [class.items-end]="msg.role === 'user'"
                 [class.items-start]="msg.role === 'assistant'">

              <!-- Message Bubble -->
              <div class="max-w-[85%]"
                   [class]="msg.role === 'user'
                     ? 'bg-accent text-white px-4 py-3 rounded-2xl rounded-tr-sm'
                     : 'bg-hover px-4 py-3 rounded-2xl rounded-tl-sm'">

                @if (msg.role === 'user') {
                  <p class="whitespace-pre-wrap text-sm">{{ msg.content }}</p>
                } @else {
                  <app-markdown-display
                    [content]="msg.content"
                    class="text-sm">
                  </app-markdown-display>
                }
              </div>

              <!-- Timestamp -->
              <span class="text-xs text-secondary mt-1 px-1">
                {{ msg.timestamp | date:'short' }}
              </span>
            </div>
          }

          <!-- Loading indicator -->
          @if (videoMixService.isGeneratingScript()) {
            <div class="flex items-start">
              <div class="bg-hover px-4 py-3 rounded-2xl rounded-tl-sm">
                <div class="flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-secondary">Refining script...</span>
                </div>
              </div>
            </div>
          }
        }
      </div>

      <!-- Input Area -->
      <div class="flex-shrink-0 border-t border-border p-4">
        <form (submit)="sendMessage($event)" class="flex gap-2">
          <textarea
            [(ngModel)]="messageInput"
            name="message"
            rows="2"
            placeholder="Describe how you'd like to change the script..."
            [disabled]="!_projectId() || videoMixService.isGeneratingScript()"
            class="flex-1 bg-background text-primary placeholder-secondary border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            (keydown.enter)="onEnterKey($any($event))">
          </textarea>

          <button
            type="submit"
            [disabled]="!messageInput.trim() || !_projectId() || videoMixService.isGeneratingScript()"
            class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class VideoMixChatComponent {
  @Input() set projectId(value: string | null) {
    this._projectId.set(value);
  }

  protected _projectId = signal<string | null>(null);

  videoMixService = inject(VideoMixService);

  messages = signal<ChatMessage[]>([]);
  messageInput = '';

  constructor() {
    // Watch for script changes to add AI responses
    effect(() => {
      const script = this.videoMixService.currentScript();
      if (script && script.ai_reasoning) {
        // Check if we need to add an AI response
        const lastMessage = this.messages()[this.messages().length - 1];
        if (!lastMessage || lastMessage.role === 'user') {
          this.addAssistantMessage(script.ai_reasoning);
        }
      }
    });
  }

  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();

    const content = this.messageInput.trim();
    if (!content || !this._projectId()) return;

    // Add user message
    this.messages.update(msgs => [...msgs, {
      role: 'user',
      content,
      timestamp: new Date()
    }]);

    // Clear input
    this.messageInput = '';

    // Call refine API
    try {
      await this.videoMixService.refineScript(this._projectId()!, content);
      // The assistant message will be added via the effect when the script updates
    } catch (error) {
      console.error('Failed to refine script:', error);
      this.messages.update(msgs => [...msgs, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while refining the script. Please try again.',
        timestamp: new Date()
      }]);
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    // Send on Enter, new line on Shift+Enter
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageInput.trim() && this._projectId() && !this.videoMixService.isGeneratingScript()) {
        this.sendMessage(event);
      }
    }
  }

  private addAssistantMessage(content: string): void {
    this.messages.update(msgs => [...msgs, {
      role: 'assistant',
      content,
      timestamp: new Date()
    }]);
  }
}

import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { ApiEndpoints } from '@core/constants/api-endpoints';
import { ChatRequest, ChatResponse, Message } from '@core/models';
import { SettingsService } from './settings.service';
import { VoiceService } from './voice.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);
  private voiceService = inject(VoiceService);

  // State
  messages = signal<Message[]>([]);
  currentConversationId = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isWaitingForResponse = computed(() => {
    const msgs = this.messages();
    return this.isLoading() && msgs.length > 0 && msgs[msgs.length - 1].role === 'user';
  });

  // Cancellation
  private stop$ = new Subject<void>();
  private activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  async sendMessage(request: ChatRequest): Promise<ChatResponse | null> {
    this.isLoading.set(true);

    try {
      return await this._sendStreaming(request);
    } catch (error) {
      if (this.isLoading()) {
        console.error('Streaming failed, falling back to non-streaming', error);
        try {
          return await this._sendNonStreaming(request);
        } catch (fallbackError) {
          console.error('Non-streaming fallback also failed', fallbackError);
          throw fallbackError;
        }
      }
      return null;
    } finally {
      this.isLoading.set(false);
      this.activeReader = null;
    }
  }

  private async _sendStreaming(request: ChatRequest): Promise<ChatResponse | null> {
    const msgId = `temp-${Date.now()}`;

    // Add empty assistant message immediately
    const assistantMessage: Message = {
      id: msgId,
      conversation_id: this.currentConversationId() || '',
      role: 'assistant',
      content: '',
      sources: [],
      search_queries: [],
      created_at: new Date().toISOString(),
      status: 'generating'
    };
    this.messages.update(msgs => [...msgs, assistantMessage]);

    const response = await fetch(ApiEndpoints.CHAT_STREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Remove the placeholder and throw so caller can show error
      this.messages.update(msgs => msgs.filter(m => m.id !== msgId));
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    this.activeReader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sources: any[] = [];
    let finalMessageId: string | null = null;

    // Cancel support via stop$
    const stopPromise = new Promise<void>(resolve => {
      const sub = this.stop$.subscribe(() => {
        this.activeReader?.cancel();
        resolve();
      });
    });

    const readLoop = async () => {
      while (true) {
        const { done, value } = await this.activeReader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));

            if (data.type === 'metadata') {
              sources = data.sources ?? [];
              if (data.conversation_id) {
                this.currentConversationId.set(data.conversation_id);
                this.messages.update(msgs =>
                  msgs.map(m => m.id === msgId
                    ? { ...m, conversation_id: data.conversation_id }
                    : m)
                );
              }
            } else if (data.type === 'token') {
              this.messages.update(msgs =>
                msgs.map(m => m.id === msgId
                  ? { ...m, content: m.content + data.delta }
                  : m)
              );
            } else if (data.done) {
              finalMessageId = data.message_id ?? msgId;
              this.messages.update(msgs =>
                msgs.map(m => m.id === msgId
                  ? { ...m, id: finalMessageId!, sources, status: 'completed' }
                  : m)
              );
            } else if (data.type === 'error') {
              this.messages.update(msgs =>
                msgs.map(m => m.id === msgId
                  ? { ...m, content: `Error: ${data.error}`, status: 'error' }
                  : m)
              );
            }
          } catch {
            // malformed event — skip
          }
        }
      }
    };

    await Promise.race([readLoop(), stopPromise]);

    // TTS after stream completes
    const finalMsg = this.messages().find(m => m.id === (finalMessageId ?? msgId));
    const prefs = this.settingsService.chatPreferences();
    if (prefs?.tts_enabled && finalMsg && this.isLoading()) {
      this.voiceService.speak(finalMsg.content);
    }

    return null;
  }

  private async _sendNonStreaming(request: ChatRequest): Promise<ChatResponse | null> {
    const response = await firstValueFrom(
      this.http.post<ChatResponse>(ApiEndpoints.CHAT, request).pipe(
        takeUntil(this.stop$)
      )
    ) as ChatResponse;

    if (response.conversation_id) {
      this.currentConversationId.set(response.conversation_id);
    }

    await this.addAssistantMessage(response.answer, response.sources, response.search_queries);
    return response;
  }

  cancelGeneration() {
    this.stop$.next();
    this.activeReader?.cancel();
    this.isLoading.set(false);
  }

  loadMessages(messages: Message[]) {
    this.messages.set(messages);
  }

  addUserMessage(content: string, images?: string[]) {
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: this.currentConversationId() || '',
      role: 'user',
      content,
      images,
      created_at: new Date().toISOString()
    };
    this.messages.update(msgs => [...msgs, userMessage]);
  }

  async addAssistantMessage(content: string, sources: any[] = [], search_queries: string[] = []) {
    const id = `temp-${Date.now()}`;
    const assistantMessage: Message = {
      id,
      conversation_id: this.currentConversationId() || '',
      role: 'assistant',
      content: '',
      sources,
      search_queries,
      created_at: new Date().toISOString(),
      status: 'generating'
    };

    this.messages.update(msgs => [...msgs, assistantMessage]);

    const chunkSize = 2;
    const delay = 10;

    for (let i = 0; i < content.length; i += chunkSize) {
      if (!this.isLoading()) break;
      const chunk = content.slice(i, i + chunkSize);
      this.messages.update(msgs =>
        msgs.map(msg => msg.id === id ? { ...msg, content: msg.content + chunk } : msg)
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.messages.update(msgs =>
      msgs.map(msg => msg.id === id ? { ...msg, status: 'completed' } : msg)
    );

    const prefs = this.settingsService.chatPreferences();
    if (prefs?.tts_enabled && this.isLoading()) {
      this.voiceService.speak(content);
    }
  }

  clearMessages() {
    this.messages.set([]);
    this.currentConversationId.set(null);
  }

  setConversationId(id: string | null) {
    this.currentConversationId.set(id);
  }
}

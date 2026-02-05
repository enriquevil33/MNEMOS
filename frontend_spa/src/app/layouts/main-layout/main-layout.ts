import { Component, signal, effect, inject, OnInit } from '@angular/core';
import { AppRoutes } from '@core/constants/app-routes';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { DocumentsService } from '../../services/documents.service';
import { ConversationsService } from '../../services/conversations.service';
import { ChatService } from '../../services/chat.service';
import { CollectionService } from '../../services/collection.service';
import { FullscreenModalComponent } from '../../components/loaders/fullscreen-modal/fullscreen-modal.component';
import { SettingsService } from '../../services/settings.service';
import { ToastrService } from 'ngx-toastr';
import { PdfViewerComponent } from '../../components/modals/pdf-viewer/pdf-viewer.component';
import { YoutubeViewer } from '../../components/modals/youtube-viewer/youtube-viewer';
import { VideoPlayerComponent } from '../../components/modals/video-player/video-player.component';
import { Document } from '@core/models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, FormsModule, FullscreenModalComponent, PdfViewerComponent, YoutubeViewer, VideoPlayerComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit {
  router = inject(Router);
  modalService = inject(ModalService);
  documentsService = inject(DocumentsService);
  conversationsService = inject(ConversationsService);
  chatService = inject(ChatService);
  collectionService = inject(CollectionService);
  settingsService = inject(SettingsService);
  public toastr = inject(ToastrService);
  protected readonly AppRoutes = AppRoutes;

  // State Signals
  theme = signal<'dark' | 'light'>('dark');
  isSidebarOpen = signal<boolean>(false);
  activeTab = signal<'chats' | 'documents'>('chats');
  isInitialLoading = signal<boolean>(true);

  // Collection selector
  selectedCollectionId = signal<string | null>(null);
  collections = signal<any[]>([]);

  // Upload Modal State
  uploadTab = signal<'file' | 'youtube'>('file');
  uploadProgress = signal<number>(0);
  isUploading = signal<boolean>(false);
  selectedFiles = signal<File[]>([]);
  youtubeUrls = signal<string[]>([]);
  youtubeUrlsText = signal<string>('');

  constructor() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) {
      this.theme.set(savedTheme);
    }

    // Apply theme effect
    effect(() => {
      const themeName = this.theme() === 'dark' ? 'mnemos-dark' : 'mnemos-light';
      document.documentElement.setAttribute('data-theme', themeName);
      localStorage.setItem('theme', this.theme());
    });
  }

  async ngOnInit() {
    this.toastr.info('Channeling incoming data...');
    this.isInitialLoading.set(true);

    try {
      // Load all initial data
      await Promise.all([
        this.conversationsService.loadConversations(),
        this.documentsService.fetchDocuments(),
        this.settingsService.loadModels(),
        this.settingsService.loadCurrentModel(),
        this.settingsService.loadChatPreferences(),
        this.settingsService.loadConnections(),
        this.loadCollections()
      ]);
      this.toastr.success('Initial data loaded successfully');
    } catch (error) {
      console.error('Failed to load initial data', error);
      this.toastr.error('Failed to load initial data. Please reload.');
    } finally {
      this.isInitialLoading.set(false);
    }
  }

  async loadCollections() {
    this.collectionService.getCollections().subscribe({
      next: (cols) => this.collections.set(cols),
      error: (err) => console.error('Failed to load collections', err)
    });
  }

  async handleSelectCollection(collectionId: string | null) {
    this.selectedCollectionId.set(collectionId);

    // Clear current document selection
    this.documentsService.clearSelection();

    if (collectionId === null) {
      // "All Documents" selected - no documents selected for chat context
      return;
    }

    // Get all documents in the selected collection and select them
    const allDocs = this.documentsService.documents();
    const collectionDocs = allDocs.filter(doc => doc.collection_id === collectionId);

    collectionDocs.forEach(doc => {
      this.documentsService.toggleDocument(doc.id);
    });

    this.toastr.info(`${collectionDocs.length} document(s) from collection will be used for chat context`);
  }

  toggleTheme() {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  switchTab(tab: 'chats' | 'documents') {
    this.activeTab.set(tab);
  }

  // Conversation Methods
  async handleSelectConversation(id: string) {
    try {
      const detail = await this.conversationsService.loadConversationDetail(id);
      this.chatService.loadMessages(detail.messages);
      this.chatService.setConversationId(id);

      // Update documents selection based on conversation history
      this.documentsService.clearSelection();
      detail.related_document_ids.forEach(docId => {
        this.documentsService.toggleDocument(docId);
      });

      // Navigate to chat if not already there
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Failed to load conversation', error);
    }
  }

  handleNewChat() {
    this.chatService.clearMessages();
    this.chatService.setConversationId(null);
    this.documentsService.clearSelection();

    // Re-select documents for the active collection if one is set
    const collectionId = this.selectedCollectionId();
    if (collectionId) {
      this.documentsService.documents()
        .filter(doc => doc.collection_id === collectionId)
        .forEach(doc => this.documentsService.toggleDocument(doc.id));
    }

    this.router.navigate(['/']);
  }

  async handleDeleteConversation(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    await this.conversationsService.deleteConversation(id);

    if (this.chatService.currentConversationId() === id) {
      this.handleNewChat();
    }
  }

  async handleDeleteDocument(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    await this.documentsService.removeDocument(id);
  }

  openPdf(doc: Document, event: Event) {
    event.stopPropagation();
    this.modalService.openPdfViewer(doc);
  }

  // Upload Modal Methods
  switchUploadTab(tab: 'file' | 'youtube') {
    this.uploadTab.set(tab);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      // Add all selected files to the array
      this.selectedFiles.update(files => [...files, ...Array.from(input.files!)]);
      // Reset input to allow selecting the same file again
      input.value = '';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Add visual feedback class if needed
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files.length) {
      // Add all dropped files to the array
      this.selectedFiles.update(files => [...files, ...Array.from(event.dataTransfer!.files)]);
    }
  }

  removeFile(index: number) {
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  parseYouTubeUrls(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const text = textarea.value;
    this.youtubeUrlsText.set(text);

    // Parse URLs from textarea (one per line)
    const urls = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    this.youtubeUrls.set(urls);
  }

  removeYouTubeUrl(index: number) {
    // Remove from array
    this.youtubeUrls.update(urls => urls.filter((_, i) => i !== index));
    // Update textarea text
    this.youtubeUrlsText.set(this.youtubeUrls().join('\n'));
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  async toggleArchive() {
    // Save preferences immediately when toggle changes
    try {
      await this.settingsService.saveChatPreferences({
        archive_enabled: this.settingsService.chatPreferences()!.archive_enabled
      });
      this.toastr.success('Archive setting saved');
    } catch (error) {
      this.toastr.error('Failed to save archive setting');
    }
  }

  async startUpload() {
    const hasFiles = this.selectedFiles().length > 0;
    const hasUrls = this.youtubeUrls().length > 0;

    if (!hasFiles && this.uploadTab() === 'file') return;
    if (!hasUrls && this.uploadTab() === 'youtube') return;

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    try {
      let successCount = 0;
      let failedCount = 0;

      if (this.uploadTab() === 'youtube') {
        const urls = this.youtubeUrls();
        const total = urls.length;

        for (let i = 0; i < total; i++) {
          const url = urls[i];
          const success = await this.documentsService.uploadYouTubeUrl(url);

          if (success) {
            successCount++;
          } else {
            failedCount++;
          }

          // Update progress
          this.uploadProgress.set(Math.round(((i + 1) / total) * 100));
        }

        // Show summary
        if (successCount > 0) {
          this.toastr.success(`${successCount} YouTube video${successCount > 1 ? 's' : ''} uploaded successfully`);
        }
        if (failedCount > 0) {
          this.toastr.error(`${failedCount} upload${failedCount > 1 ? 's' : ''} failed`);
        }

      } else {
        const files = this.selectedFiles();
        const total = files.length;

        for (let i = 0; i < total; i++) {
          const file = files[i];
          const success = await this.documentsService.uploadDocument(file);

          if (success) {
            successCount++;
          } else {
            failedCount++;
          }

          // Update progress
          this.uploadProgress.set(Math.round(((i + 1) / total) * 100));
        }

        // Show summary
        if (successCount > 0) {
          this.toastr.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
        }
        if (failedCount > 0) {
          this.toastr.error(`${failedCount} upload${failedCount > 1 ? 's' : ''} failed`);
        }
      }

      // Reset and close
      setTimeout(() => {
        this.isUploading.set(false);
        this.modalService.closeUpload();
        this.uploadProgress.set(0);
        this.selectedFiles.set([]);
        this.youtubeUrls.set([]);
        this.youtubeUrlsText.set('');
      }, 500);

    } catch (error) {
      console.error(error);
      this.isUploading.set(false);
      this.toastr.error('Upload failed. Please try again.');
    }
  }
}

import { Component, signal, effect, inject, OnInit } from '@angular/core';
import { ThemeService } from '@services/theme.service';
import { AppRoutes } from '@core/constants/app-routes';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ModalService } from '@services/modal.service';
import { DocumentsService } from '@services/documents.service';
import { ConversationsService } from '@services/conversations.service';
import { ChatService } from '@services/chat.service';
import { CollectionService } from '@services/collection.service';
import { FullscreenModalComponent } from '@components/loaders/fullscreen-modal/fullscreen-modal.component';
import { SettingsService } from '@services/settings.service';
import { ToastrService } from 'ngx-toastr';
import { PdfViewerComponent } from '@components/modals/pdf-viewer/pdf-viewer.component';
import { YoutubeViewer } from '@components/modals/youtube-viewer/youtube-viewer';
import { VideoPlayerComponent } from '@components/modals/video-player/video-player.component';
import { Document } from '@core/models';

import { SidebarComponent } from '@components/sidebar/sidebar.component';
import { UploadModalComponent } from '@components/modals/upload-modal/upload-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FullscreenModalComponent, PdfViewerComponent, YoutubeViewer, VideoPlayerComponent, SidebarComponent, UploadModalComponent],
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

  themeService = inject(ThemeService);

  // State Signals
  isSidebarOpen = signal<boolean>(false);
  isInitialLoading = signal<boolean>(true);

  constructor() { }

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
        this.settingsService.loadConnections()
      ]);
      this.toastr.success('Initial data loaded successfully');
    } catch (error) {
      console.error('Failed to load initial data', error);
      this.toastr.error('Failed to load initial data. Please reload.');
    } finally {
      this.isInitialLoading.set(false);
    }
  }




  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

}

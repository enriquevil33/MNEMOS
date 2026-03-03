import { Component, WritableSignal, input, inject, Output, EventEmitter, OnInit, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AppRoutes } from '@core/constants/app-routes';
import { ModalService } from '@services/modal.service';
import { DocumentsService } from '@services/documents.service';
import { ConversationsService } from '@services/conversations.service';
import { ChatService } from '@services/chat.service';
import { CollectionService } from '@services/collection.service';
import { Document } from '@core/models';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './sidebar.component.html',
    host: {
        class: 'flex flex-col h-full w-full overflow-hidden'
    }
})
export class SidebarComponent implements OnInit {
    isSidebarOpen = input.required<WritableSignal<boolean>>();
    theme = input.required<WritableSignal<'dark' | 'light'>>();

    router = inject(Router);
    modalService = inject(ModalService);
    themeService = inject(ThemeService);
    documentsService = inject(DocumentsService);
    conversationsService = inject(ConversationsService);
    chatService = inject(ChatService);
    collectionService = inject(CollectionService);
    protected readonly AppRoutes = AppRoutes;

    activeTab = signal<'chats' | 'documents'>('chats');
    selectedCollectionId = signal<string | null>(null);
    collections = signal<any[]>([]);
    searchQuery = signal<string>('');

    filteredConversations = computed(() => {
        const query = this.searchQuery().toLowerCase();
        const convs = this.conversationsService.conversations();
        if (!query) return convs;
        return convs.filter(c => c.title?.toLowerCase().includes(query));
    });

    filteredDocuments = computed(() => {
        const query = this.searchQuery().toLowerCase();
        const docs = this.documentsService.documents();
        if (!query) return docs;
        return docs.filter(d => d.original_filename?.toLowerCase().includes(query));
    });

    ngOnInit() {
        this.collectionService.getCollections().subscribe({
            next: (cols) => this.collections.set(cols),
            error: (err) => console.error('Failed to load collections', err)
        });
    }

    toggleTheme() {
        this.theme().update(t => t === 'dark' ? 'light' : 'dark');
    }

    toggleSidebar() {
        this.isSidebarOpen().update(v => !v);
    }

    switchTab(tab: 'chats' | 'documents') {
        this.activeTab.set(tab);
        this.searchQuery.set('');
    }

    async handleSelectCollection(collectionId: string | null) {
        this.selectedCollectionId.set(collectionId);

        // Clear current document selection
        this.documentsService.clearSelection();

        if (collectionId === null) {
            return;
        }

        const allDocs = this.documentsService.documents();
        const collectionDocs = allDocs.filter(doc => doc.collection_id === collectionId);

        collectionDocs.forEach(doc => {
            this.documentsService.toggleDocument(doc.id);
        });
    }

    async handleSelectConversation(id: string) {
        try {
            const detail = await this.conversationsService.loadConversationDetail(id);
            this.chatService.loadMessages(detail.messages);
            this.chatService.setConversationId(id);

            this.documentsService.clearSelection();
            detail.related_document_ids.forEach(docId => {
                this.documentsService.toggleDocument(docId);
            });

            this.router.navigate(['/']);
        } catch (error) {
            console.error('Failed to load conversation', error);
        }
    }

    handleNewChat() {
        this.chatService.clearMessages();
        this.chatService.setConversationId(null);
        this.documentsService.clearSelection();

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

    openVideo(doc: Document, event: Event) {
        event.stopPropagation();
        const url = `/api/documents/${doc.id}/content`;
        this.modalService.openVideoPlayer(url);
    }

    openYouTube(doc: Document, event: Event) {
        event.stopPropagation();
        if (doc.youtube_url) {
            this.modalService.openYoutubeViewer(doc.youtube_url);
        } else {
            console.error('YouTube URL not found for this video');
        }
    }
}

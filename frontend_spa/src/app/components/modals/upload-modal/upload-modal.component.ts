import { Component, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { DocumentsService } from '../../../services/documents.service';
import { SettingsService } from '../../../services/settings.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-upload-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './upload-modal.component.html',
})
export class UploadModalComponent {
    modalService = inject(ModalService);
    documentsService = inject(DocumentsService);
    settingsService = inject(SettingsService);
    public toastr = inject(ToastrService);

    // Upload Modal State
    uploadTab = signal<'file' | 'youtube'>('file');
    uploadProgress = signal<number>(0);
    isUploading = signal<boolean>(false);
    selectedFiles = signal<File[]>([]);
    youtubeUrls = signal<string[]>([]);
    youtubeUrlsText = signal<string>('');

    switchUploadTab(tab: 'file' | 'youtube') {
        this.uploadTab.set(tab);
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files?.length) {
            this.selectedFiles.update(files => [...files, ...Array.from(input.files!)]);
            input.value = '';
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer?.files.length) {
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

        const urls = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        this.youtubeUrls.set(urls);
    }

    removeYouTubeUrl(index: number) {
        this.youtubeUrls.update(urls => urls.filter((_, i) => i !== index));
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

                    this.uploadProgress.set(Math.round(((i + 1) / total) * 100));
                }

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

                    this.uploadProgress.set(Math.round(((i + 1) / total) * 100));
                }

                if (successCount > 0) {
                    this.toastr.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
                }
                if (failedCount > 0) {
                    this.toastr.error(`${failedCount} upload${failedCount > 1 ? 's' : ''} failed`);
                }
            }

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

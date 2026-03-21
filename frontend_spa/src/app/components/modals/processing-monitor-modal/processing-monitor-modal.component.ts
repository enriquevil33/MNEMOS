import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { DocumentsService } from '../../../services/documents.service';
import { Document } from '../../../core/models';

@Component({
    selector: 'app-processing-monitor-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './processing-monitor-modal.component.html',
})
export class ProcessingMonitorModalComponent {
    modalService = inject(ModalService);
    documentsService = inject(DocumentsService);

    // Get the documents that are currently processing
    processingDocuments = this.documentsService.processingDocuments;

    getProcessText(progress: number | undefined): string {
        if (progress === undefined) return 'Pending...';
        if (progress < 30) return 'Extracting Data...';
        if (progress < 50) return 'Preparing for Vectorization...';
        if (progress < 70) return 'Vectorizing & Embedding...';
        if (progress < 90) return 'AI Summarization & Graph Extraction...';
        if (progress < 100) return 'Finalizing...';
        return 'Completed';
    }

    getProgressWidth(progress: number | undefined): string {
        if (progress === undefined) return '0%';
        // Max 100% just in case
        return Math.min(progress, 100) + '%';
    }
}

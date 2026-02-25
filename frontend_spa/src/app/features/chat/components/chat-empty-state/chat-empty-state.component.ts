import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '@services/modal.service';

@Component({
    selector: 'app-chat-empty-state',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './chat-empty-state.component.html',
})
export class ChatEmptyStateComponent {
    modalService = inject(ModalService);

    @Output() openLlmModal = new EventEmitter<void>();
}

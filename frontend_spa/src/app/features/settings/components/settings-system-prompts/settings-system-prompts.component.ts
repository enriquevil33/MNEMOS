import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@services/settings.service';
import { SystemPrompt } from '@core/models';

@Component({
    selector: 'app-settings-system-prompts',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-system-prompts.component.html'
})
export class SettingsSystemPromptsComponent {
    settingsService = inject(SettingsService);

    isPromptModalOpen = signal<boolean>(false);
    editingPromptId = signal<string | null>(null);
    promptForm = signal<{ title: string, content: string }>({ title: '', content: '' });

    openPromptModal(prompt?: SystemPrompt) {
        if (prompt) {
            this.editingPromptId.set(prompt.id);
            this.promptForm.set({ title: prompt.title, content: prompt.content });
        } else {
            this.editingPromptId.set(null);
            this.promptForm.set({ title: '', content: '' });
        }
        this.isPromptModalOpen.set(true);
    }

    closePromptModal() {
        this.isPromptModalOpen.set(false);
    }

    async handleSavePrompt() {
        const { title, content } = this.promptForm();
        if (!title || !content) return;

        if (this.editingPromptId()) {
            await this.settingsService.updateSystemPrompt(this.editingPromptId()!, { title, content });
        } else {
            await this.settingsService.createSystemPrompt(title, content);
        }
        this.closePromptModal();
    }

    async handleDeletePrompt(id: string) {
        if (!confirm('Delete this prompt?')) return;
        await this.settingsService.deleteSystemPrompt(id);
    }
}

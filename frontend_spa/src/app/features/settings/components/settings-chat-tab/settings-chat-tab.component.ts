import { Component, computed, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@services/settings.service';
import { ToastrService } from 'ngx-toastr';
import { ChatPreferences } from '@core/models';
import { LlmSelectorComponent } from '@shared/components/llm-selector/llm-selector.component';
import { LlmGenerationParamsComponent } from '../llm-generation-params/llm-generation-params.component';
import { SettingsSystemPromptsComponent } from '../settings-system-prompts/settings-system-prompts.component';

@Component({
    selector: 'app-settings-chat-tab',
    standalone: true,
    imports: [CommonModule, FormsModule, LlmSelectorComponent, LlmGenerationParamsComponent, SettingsSystemPromptsComponent],
    templateUrl: './settings-chat-tab.component.html'
})
export class SettingsChatTabComponent {
    settingsService = inject(SettingsService);
    toastr = inject(ToastrService);

    chatSelector = viewChild<LlmSelectorComponent>('chatSelector');
    memorySelector = viewChild<LlmSelectorComponent>('memorySelector');

    memoryLlmPreferences = computed(() => {
        const prefs = this.settingsService.chatPreferences();
        if (!prefs) return null;
        return {
            ...prefs,
            llm_provider: prefs.memory_provider,
            selected_llm_model: prefs.memory_llm_model
        } as ChatPreferences;
    });

    getTranscriptionConnection() {
        const providerId = this.settingsService.chatPreferences()?.transcription_provider;
        if (!providerId || ['local', 'groq', 'openai', 'deepgram'].includes(providerId)) return null;
        return this.settingsService.llmConnections().find(c => c.id === providerId);
    }

    async handleSaveChatPreferences() {
        const currentPrefs = this.settingsService.chatPreferences();
        if (!currentPrefs) return;

        const chatSel = this.chatSelector();
        let chatUpdate: any = {};

        try {
            if (chatSel) {
                const snapshot = chatSel.getSnapshot();

                if (snapshot.llm_provider === 'custom') {
                    const name = chatSel.connForm.name();
                    const url = chatSel.connForm.baseUrl();

                    if (name && url) {
                        try {
                            await chatSel.saveConnection();
                            const newSnapshot = chatSel.getSnapshot();
                            Object.assign(snapshot, newSnapshot);
                            this.toastr.info('Connection details updated automatically', 'Unified Save');
                        } catch (e) {
                            console.warn("Auto-save of connection failed", e);
                        }
                    }
                }

                chatUpdate = snapshot;
            }

            const memSel = this.memorySelector();
            let memUpdate: any = {};

            if (memSel) {
                const snapshot = memSel.getSnapshot();
                memUpdate.memory_provider = snapshot.llm_provider;
                memUpdate.memory_llm_model = snapshot.selected_llm_model;

                if (snapshot.openai_api_key) memUpdate.openai_api_key = snapshot.openai_api_key;
                if (snapshot.anthropic_api_key) memUpdate.anthropic_api_key = snapshot.anthropic_api_key;
                if (snapshot.groq_api_key) memUpdate.groq_api_key = snapshot.groq_api_key;
                if (snapshot.custom_api_key) memUpdate.custom_api_key = snapshot.custom_api_key;
                if (snapshot.local_llm_base_url) memUpdate.local_llm_base_url = snapshot.local_llm_base_url;
            }

            const finalPrefs: ChatPreferences = {
                ...currentPrefs,
                ...chatUpdate,
                ...memUpdate
            };

            await this.settingsService.saveChatPreferences(finalPrefs);

            this.toastr.success('Settings saved successfully');
        } catch (e: any) {
            console.error(e);
            const msg = e.error?.error || 'Failed to save settings. Please check your inputs.';
            this.toastr.error(msg, 'Error saving settings');
        }
    }
}

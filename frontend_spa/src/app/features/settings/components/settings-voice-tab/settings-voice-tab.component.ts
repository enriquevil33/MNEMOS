import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@services/settings.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-settings-voice-tab',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-voice-tab.component.html'
})
export class SettingsVoiceTabComponent {
    settingsService = inject(SettingsService);
    toastr = inject(ToastrService);

    async handleSaveChatPreferences() {
        const prefs = this.settingsService.chatPreferences();
        if (!prefs) return;
        try {
            await this.settingsService.saveChatPreferences(prefs);
            this.toastr.success('Voice settings saved successfully');
        } catch (e: any) {
            this.toastr.error('Failed to save voice settings');
        }
    }
}

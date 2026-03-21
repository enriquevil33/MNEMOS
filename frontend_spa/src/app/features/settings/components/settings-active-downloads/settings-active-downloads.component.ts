import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarComponent } from '@shared/components/progress-bar/progress-bar.component';

@Component({
    selector: 'app-settings-active-downloads',
    standalone: true,
    imports: [CommonModule, ProgressBarComponent],
    templateUrl: './settings-active-downloads.component.html'
})
export class SettingsActiveDownloadsComponent {
    downloads = input.required<any[]>();
    onDeletePull = output<string>();

    handleDeletePull(taskId: string) {
        this.onDeletePull.emit(taskId);
    }
}

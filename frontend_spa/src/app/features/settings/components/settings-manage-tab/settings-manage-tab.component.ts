import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-settings-manage-tab',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './settings-manage-tab.component.html'
})
export class SettingsManageTabComponent {
    importFiles = input.required<string[]>();

    onScanImports = output<void>();
    onFileUpload = output<Event>();

    scanImports() {
        this.onScanImports.emit();
    }

    handleFileUpload(event: Event) {
        this.onFileUpload.emit(event);
    }
}

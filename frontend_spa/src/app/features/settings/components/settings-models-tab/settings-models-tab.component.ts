import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-settings-models-tab',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './settings-models-tab.component.html'
})
export class SettingsModelsTabComponent {
    models = input.required<any[]>();
    currentModel = input<string | null>(null);

    onSetCurrentModel = output<string>();

    handleSetCurrentModel(filename: string) {
        this.onSetCurrentModel.emit(filename);
    }
}

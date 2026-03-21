import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DocumentsService } from '@services/documents.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
    title = 'MNEMOS';
    documentsService = inject(DocumentsService);

    ngOnInit() {
        // Fetch documents on initial load to resume background polling tasks
        this.documentsService.fetchDocuments();
    }
}

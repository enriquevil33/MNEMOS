import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiEndpoints } from '@core/constants/api-endpoints';
import { WikiArticle, WikiConceptList, WikiSearchResult } from '@core/models';

@Injectable({ providedIn: 'root' })
export class WikiService {
  constructor(private http: HttpClient) {}

  /** Alphabetical concept list with optional letter filter and pagination. */
  listConcepts(letter = '', limit = 100, offset = 0, collectionId?: string, documentId?: string): Observable<WikiConceptList> {
    const params: Record<string, string | number> = { limit, offset };
    if (letter) params['letter'] = letter;
    if (collectionId) params['collection_id'] = collectionId;
    if (documentId) params['document_id'] = documentId;
    return this.http.get<WikiConceptList>(ApiEndpoints.WIKI_CONCEPTS, { params });
  }

  /** Full article for a concept name. */
  getArticle(name: string): Observable<WikiArticle> {
    return this.http.get<WikiArticle>(ApiEndpoints.WIKI_ARTICLE(name));
  }

  /** Hybrid search (prefix + vector). */
  search(q: string, limit = 20): Observable<WikiSearchResult> {
    return this.http.get<WikiSearchResult>(ApiEndpoints.WIKI_SEARCH, { params: { q, limit } });
  }
}

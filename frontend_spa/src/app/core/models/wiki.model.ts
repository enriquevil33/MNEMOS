export interface WikiConceptStub {
  id: string;
  name: string;
  description: string;
}

export interface WikiRelation {
  description: string;
  peers: { name: string; id: string; role: string }[];
  source_document_id: string | null;
  source_chunk_id: string | null;
}

export interface WikiSource {
  chunk_id: string;
  content: string;
  page_number: number | null;
  start_time: number | null;
  end_time: number | null;
  document_id: string;
  document_title: string;
  file_type: 'pdf' | 'audio' | 'video' | 'youtube' | 'epub' | null;
  youtube_url: string | null;
}

export interface WikiArticle {
  id: string;
  name: string;
  description: string;
  relations: WikiRelation[];
  sources: WikiSource[];
  related: WikiConceptStub[];
}

export interface WikiConceptList {
  concepts: WikiConceptStub[];
  total: number;
  offset: number;
  limit: number;
}

export interface WikiSearchResult {
  results: WikiConceptStub[];
  total: number;
}

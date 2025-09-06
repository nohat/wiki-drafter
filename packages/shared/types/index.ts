export interface WikiDraftConfig {
  cite_style: 'named-refs' | 'footnotes';
  as_of_year_threshold: number;
  llm: {
    provider: 'ollama' | 'openai' | 'anthropic';
    model: string;
    temperature: number;
  };
  wikimedia_auth: {
    method: 'botpassword' | 'oauth';
    username: string;
    password: string;
  };
  parsoid: {
    endpoint: string;
  };
  citoid: {
    endpoint: string;
  };
  policy: {
    inline_for: string[];
  };
  thresholds: {
    source_quality_high_risk_min: number;
    copyvio_max_similarity: number;
  };
}

export interface Claim {
  id: string;
  section: string;
  start: number;
  end: number;
  text: string;
  type: 'statistic' | 'BLP' | 'quote' | 'contentious' | 'general';
  risk: 'low' | 'medium' | 'high';
  requires_inline: boolean;
  existing_refs: string[];
  status: 'unsupported' | 'supported' | 'pending';
  sources: string[];
  source_quality?: number;
  as_of?: string;
  notes?: string;
}

export interface ClaimsDocument {
  article: string;
  rev: number;
  claims: Claim[];
}

export interface Source {
  normalized_key: string;
  csl_json: any;
  cite_template: string;
  rsp_label: string;
  publisher: string;
  is_primary: boolean;
  is_independent: boolean;
  archive_url?: string;
  oa_flag: boolean;
  access_date: string;
}

export interface RSPEntry {
  label: 'generally reliable' | 'deprecated' | 'context-dependent' | 'blacklisted';
  notes?: string;
}

export interface FeedbackEntry {
  ts: string;
  article: string;
  rev: number;
  claim_id: string;
  suggestion_type: string;
  ai_choice: any;
  user_action: 'accept' | 'edit' | 'reject' | 'defer';
  reason: string;
  notes?: string;
}

export interface RenderResponse {
  html: string;
  dsr_map: any;
}

export interface CitoidResponse {
  csl_json: any;
  template: string;
  refname: string;
}

export interface ArchiveResponse {
  archive_url: string;
  archive_date: string;
  status: 'success' | 'failed' | 'pending';
}

export interface CopyVioResponse {
  similarity_max: number;
  matches: Array<{
    url: string;
    score: number;
  }>;
}

export interface SourceQualityResponse {
  source_quality: number;
  rsp_label: string;
  reasons: string[];
}
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// Projects
// ============================================================

export interface ProjectRow {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  summary: string | null;
  problem_statement: string | null;
  solution: string | null;
  target_audience: string | null;
  geography: string | null;
  stage: string | null;
  technology: string | null;
  impact: string | null;
  reusable_grant_language: string | null;
  category: string | null;
  grant_relevance: string | null;
  featured: boolean;
  public_visibility: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = {
  id?: string;
  organization_id?: string | null;
  name: string;
  slug: string;
  summary?: string | null;
  problem_statement?: string | null;
  solution?: string | null;
  target_audience?: string | null;
  geography?: string | null;
  stage?: string | null;
  technology?: string | null;
  impact?: string | null;
  reusable_grant_language?: string | null;
  category?: string | null;
  grant_relevance?: string | null;
  featured?: boolean;
  public_visibility?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectUpdate = Partial<ProjectInsert>;

// ============================================================
// Proof Items
// ============================================================

export type ProofItemDbType =
  | "workshop"
  | "app_demo"
  | "document"
  | "metric"
  | "testimonial"
  | "case_study"
  | "media";

export interface ProofItemRow {
  id: string;
  project_id: string | null;
  title: string;
  type: ProofItemDbType;
  description: string | null;
  date: string | null;
  media_url: string | null;
  document_url: string | null;
  metrics: Json | null;
  tags: string[];
  grant_relevance: string | null;
  public_visibility: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProofItemInsert = {
  id?: string;
  project_id?: string | null;
  title: string;
  type: ProofItemDbType;
  description?: string | null;
  date?: string | null;
  media_url?: string | null;
  document_url?: string | null;
  metrics?: Json | null;
  tags?: string[];
  grant_relevance?: string | null;
  public_visibility?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProofItemUpdate = Partial<ProofItemInsert>;

// ============================================================
// Grants
// ============================================================

export type GrantDbStatus =
  | "Planned"
  | "Researching"
  | "Applying"
  | "Submitted"
  | "Awarded"
  | "Declined"
  | "Archived";

export interface GrantRow {
  id: string;
  title: string;
  funder_id: string | null;
  funder_name: string | null;
  related_project_id: string | null;
  related_project_slug: string | null;
  deadline: string | null;
  next_deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_display: string | null;
  focus_areas: string[];
  geography: string | null;
  eligibility: string | null;
  application_url: string | null;
  source_url: string | null;
  required_documents: string[];
  application_questions: Json | null;
  status: GrantDbStatus;
  priority: string | null;
  fit_score: number | null;
  priority_score: number | null;
  difficulty_score: number | null;
  proof_readiness: string | null;
  application_readiness: string | null;
  is_top_three: boolean;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GrantInsert = {
  id?: string;
  title: string;
  funder_id?: string | null;
  funder_name?: string | null;
  related_project_id?: string | null;
  related_project_slug?: string | null;
  deadline?: string | null;
  next_deadline?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  amount_display?: string | null;
  focus_areas?: string[];
  geography?: string | null;
  eligibility?: string | null;
  application_url?: string | null;
  source_url?: string | null;
  required_documents?: string[];
  application_questions?: Json | null;
  status?: GrantDbStatus;
  priority?: string | null;
  fit_score?: number | null;
  priority_score?: number | null;
  difficulty_score?: number | null;
  proof_readiness?: string | null;
  application_readiness?: string | null;
  is_top_three?: boolean;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GrantUpdate = Partial<GrantInsert>;

// ============================================================
// Supabase Database shape (used by createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
      proof_items: {
        Row: ProofItemRow;
        Insert: ProofItemInsert;
        Update: ProofItemUpdate;
        Relationships: [
          {
            foreignKeyName: "proof_items_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      grants: {
        Row: GrantRow;
        Insert: GrantInsert;
        Update: GrantUpdate;
        Relationships: [
          {
            foreignKeyName: "grants_related_project_id_fkey";
            columns: ["related_project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

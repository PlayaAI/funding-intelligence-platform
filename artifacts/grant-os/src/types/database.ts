export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

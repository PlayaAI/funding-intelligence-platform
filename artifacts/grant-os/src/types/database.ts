export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// Profiles (auth.users)
// ============================================================

export type AppRoleDb = "Admin" | "Grant Lead" | "Contributor" | "Viewer";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRoleDb;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdate = {
  full_name?: string | null;
  updated_at?: string;
};

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
// Funders
// ============================================================

export type FunderRelationshipStatus =
  | "None"
  | "Researching"
  | "Contacted"
  | "In Conversation"
  | "Active Relationship";

export interface FunderRow {
  id: string;
  legacy_id: string | null;
  name: string;
  slug: string | null;
  website: string | null;
  ein: string | null;
  location: string | null;
  address: string | null;
  phone: string | null;
  contact_info: string | null;
  key_people: Json | null;
  assets: number | null;
  annual_giving: number | null;
  median_grant_amount: number | null;
  giving_areas: string[];
  openness_to_new_grantees: string | null;
  relationship_status: string | null;
  past_grantees: string[];
  open_applications: boolean;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FunderInsert = {
  id?: string;
  legacy_id?: string | null;
  name: string;
  slug?: string | null;
  website?: string | null;
  ein?: string | null;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  contact_info?: string | null;
  key_people?: Json | null;
  assets?: number | null;
  annual_giving?: number | null;
  median_grant_amount?: number | null;
  giving_areas?: string[];
  openness_to_new_grantees?: string | null;
  relationship_status?: string | null;
  past_grantees?: string[];
  open_applications?: boolean;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FunderUpdate = Partial<FunderInsert>;

// ============================================================
// Peer Organizations
// ============================================================

export interface PeerOrganizationRow {
  id: string;
  legacy_id: string | null;
  name: string;
  slug: string | null;
  website: string | null;
  ein: string | null;
  location: string | null;
  address: string | null;
  description: string | null;
  assets: number | null;
  annual_revenue: number | null;
  focus_areas: string[];
  relevance: string | null;
  key_people: Json | null;
  saved_opportunities: Json | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PeerOrganizationInsert = {
  id?: string;
  legacy_id?: string | null;
  name: string;
  slug?: string | null;
  website?: string | null;
  ein?: string | null;
  location?: string | null;
  address?: string | null;
  description?: string | null;
  assets?: number | null;
  annual_revenue?: number | null;
  focus_areas?: string[];
  relevance?: string | null;
  key_people?: Json | null;
  saved_opportunities?: Json | null;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PeerOrganizationUpdate = Partial<PeerOrganizationInsert>;

// ============================================================
// Peer Funding Records
// ============================================================

export interface PeerFundingRecordRow {
  id: string;
  peer_organization_id: string;
  funder_id: string | null;
  funder_name: string | null;
  year: number | null;
  amount: number | null;
  source_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PeerFundingRecordInsert = {
  id?: string;
  peer_organization_id: string;
  funder_id?: string | null;
  funder_name?: string | null;
  year?: number | null;
  amount?: number | null;
  source_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PeerFundingRecordUpdate = Partial<PeerFundingRecordInsert>;

// ============================================================
// Applications
// ============================================================

export type ApplicationDbStatus =
  | "Not Started"
  | "Drafting"
  | "Internal Review"
  | "Ready to Submit"
  | "Submitted"
  | "Awarded"
  | "Declined"
  | "Archived";

export interface ApplicationRow {
  id: string;
  grant_id: string | null;
  project_id: string | null;
  title: string;
  status: ApplicationDbStatus;
  owner_name: string | null;
  google_doc_url: string | null;
  drive_folder_url: string | null;
  portal_url: string | null;
  submitted_at: string | null;
  result: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ApplicationInsert = {
  id?: string;
  grant_id?: string | null;
  project_id?: string | null;
  title: string;
  status?: ApplicationDbStatus;
  owner_name?: string | null;
  google_doc_url?: string | null;
  drive_folder_url?: string | null;
  portal_url?: string | null;
  submitted_at?: string | null;
  result?: string | null;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationUpdate = Partial<ApplicationInsert>;

// ============================================================
// Application Questions
// ============================================================

export type ApplicationQuestionDbStatus =
  | "Draft"
  | "Needs Review"
  | "Approved"
  | "Final";

export interface ApplicationQuestionRow {
  id: string;
  application_id: string;
  question: string;
  word_limit: number | null;
  draft_answer: string | null;
  final_answer: string | null;
  owner_name: string | null;
  status: ApplicationQuestionDbStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ApplicationQuestionInsert = {
  id?: string;
  application_id: string;
  question: string;
  word_limit?: number | null;
  draft_answer?: string | null;
  final_answer?: string | null;
  owner_name?: string | null;
  status?: ApplicationQuestionDbStatus;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationQuestionUpdate = Partial<ApplicationQuestionInsert>;

// ============================================================
// Application Required Documents
// ============================================================

export type ApplicationRequiredDocumentDbStatus =
  | "Needed"
  | "In Progress"
  | "Complete"
  | "Not Applicable";

export interface ApplicationRequiredDocumentRow {
  id: string;
  application_id: string;
  title: string;
  description: string | null;
  status: ApplicationRequiredDocumentDbStatus;
  url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ApplicationRequiredDocumentInsert = {
  id?: string;
  application_id: string;
  title: string;
  description?: string | null;
  status?: ApplicationRequiredDocumentDbStatus;
  url?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationRequiredDocumentUpdate = Partial<ApplicationRequiredDocumentInsert>;

// ============================================================
// Tasks
// ============================================================

export type TaskDbStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting"
  | "Needs Review"
  | "Complete"
  | "Archived";

export type TaskDbPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Urgent";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  owner_name: string | null;
  status: TaskDbStatus;
  priority: TaskDbPriority;
  due_date: string | null;
  related_project_id: string | null;
  related_grant_id: string | null;
  related_application_id: string | null;
  related_proof_item_id: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = {
  id?: string;
  title: string;
  description?: string | null;
  owner_name?: string | null;
  status?: TaskDbStatus;
  priority?: TaskDbPriority;
  due_date?: string | null;
  related_project_id?: string | null;
  related_grant_id?: string | null;
  related_application_id?: string | null;
  related_proof_item_id?: string | null;
  notes?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TaskUpdate = Partial<TaskInsert>;

// ============================================================
// Supabase Database shape (used by createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: ProfileUpdate;
        Relationships: [];
      };
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
      funders: {
        Row: FunderRow;
        Insert: FunderInsert;
        Update: FunderUpdate;
        Relationships: [];
      };
      peer_organizations: {
        Row: PeerOrganizationRow;
        Insert: PeerOrganizationInsert;
        Update: PeerOrganizationUpdate;
        Relationships: [];
      };
      peer_funding_records: {
        Row: PeerFundingRecordRow;
        Insert: PeerFundingRecordInsert;
        Update: PeerFundingRecordUpdate;
        Relationships: [
          {
            foreignKeyName: "peer_funding_records_peer_organization_id_fkey";
            columns: ["peer_organization_id"];
            referencedRelation: "peer_organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "peer_funding_records_funder_id_fkey";
            columns: ["funder_id"];
            referencedRelation: "funders";
            referencedColumns: ["id"];
          }
        ];
      };
      applications: {
        Row: ApplicationRow;
        Insert: ApplicationInsert;
        Update: ApplicationUpdate;
        Relationships: [
          {
            foreignKeyName: "applications_grant_id_fkey";
            columns: ["grant_id"];
            referencedRelation: "grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      application_questions: {
        Row: ApplicationQuestionRow;
        Insert: ApplicationQuestionInsert;
        Update: ApplicationQuestionUpdate;
        Relationships: [
          {
            foreignKeyName: "application_questions_application_id_fkey";
            columns: ["application_id"];
            referencedRelation: "applications";
            referencedColumns: ["id"];
          }
        ];
      };
      application_required_documents: {
        Row: ApplicationRequiredDocumentRow;
        Insert: ApplicationRequiredDocumentInsert;
        Update: ApplicationRequiredDocumentUpdate;
        Relationships: [
          {
            foreignKeyName: "application_required_documents_application_id_fkey";
            columns: ["application_id"];
            referencedRelation: "applications";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskInsert;
        Update: TaskUpdate;
        Relationships: [
          {
            foreignKeyName: "tasks_related_project_id_fkey";
            columns: ["related_project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_related_grant_id_fkey";
            columns: ["related_grant_id"];
            referencedRelation: "grants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_related_application_id_fkey";
            columns: ["related_application_id"];
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_related_proof_item_id_fkey";
            columns: ["related_proof_item_id"];
            referencedRelation: "proof_items";
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

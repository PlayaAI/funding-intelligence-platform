export type DocumentType = "Google Doc" | "Google Drive Folder" | "PDF" | "External Link" | "Internal Note";

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  url?: string;
  description?: string;
  relatedProjectSlug?: string;
  relatedProjectName?: string;
  relatedGrantId?: string;
  relatedGrantTitle?: string;
  relatedApplicationId?: string;
  createdAt: string;
  isPublic: boolean;
  tags: string[];
}

export const documents: Document[] = [
  {
    id: "doc1",
    title: "Connect App — Grant Application Draft (Wellspring)",
    type: "Google Doc",
    url: "https://docs.google.com/document/d/placeholder",
    description: "Working draft for Wellspring Foundation application. All question responses and supporting narrative.",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    relatedGrantId: "g4",
    relatedGrantTitle: "Wellspring Foundation",
    relatedApplicationId: "a1",
    createdAt: "2026-05-01",
    isPublic: false,
    tags: ["grant application", "draft", "wellspring"],
  },
  {
    id: "doc2",
    title: "Connect App — Application Assets Folder",
    type: "Google Drive Folder",
    url: "https://drive.google.com/drive/folders/placeholder",
    description: "Folder containing all supporting documents, photos, and attachments for Wellspring application.",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    relatedApplicationId: "a1",
    createdAt: "2026-05-01",
    isPublic: false,
    tags: ["grant assets", "wellspring"],
  },
  {
    id: "doc3",
    title: "Biohack Your Burn — Published Guide",
    type: "PDF",
    description: "Published wellbeing guide produced from the Biohack Your Burn workshop. Community-tested and distributed.",
    relatedProjectSlug: "biohack-burn",
    relatedProjectName: "Biohack Your Burn",
    createdAt: "2024-07-20",
    isPublic: true,
    tags: ["workshop output", "published", "wellness"],
  },
  {
    id: "doc4",
    title: "Connect App — Session Protocol v1.2",
    type: "Google Doc",
    url: "https://docs.google.com/document/d/protocol-placeholder",
    description: "Detailed guided connection session protocol documentation including question frameworks and facilitator notes.",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    createdAt: "2024-09-10",
    isPublic: false,
    tags: ["protocol", "methodology", "internal"],
  },
  {
    id: "doc5",
    title: "Oracle Art Demo — Application (Burning Man Project)",
    type: "Google Doc",
    url: "https://docs.google.com/document/d/placeholder2",
    description: "Submitted application to Burning Man Project arts grant. Includes project description and budget.",
    relatedProjectSlug: "oracle",
    relatedProjectName: "Oracle Art Demo",
    relatedGrantId: "g6",
    relatedGrantTitle: "Burning Man Project",
    relatedApplicationId: "a3",
    createdAt: "2026-03-15",
    isPublic: false,
    tags: ["submitted", "burning man", "arts grant"],
  },
  {
    id: "doc6",
    title: "Funder Research — Loneliness & Social Health Space",
    type: "Google Doc",
    url: "https://docs.google.com/document/d/funder-research-placeholder",
    description: "Research summary on funders in the loneliness, social health, and community technology space. Includes peer org funding records.",
    createdAt: "2026-04-15",
    isPublic: false,
    tags: ["research", "funders", "strategy"],
  },
  {
    id: "doc7",
    title: "Playa AI — Grant Strategy Overview 2026",
    type: "Google Doc",
    url: "https://docs.google.com/document/d/strategy-placeholder",
    description: "Internal strategy document covering grant priorities, target funders, and 12-month application calendar.",
    createdAt: "2026-01-10",
    isPublic: false,
    tags: ["strategy", "planning", "internal"],
  },
  {
    id: "doc8",
    title: "MIT Solve Challenge Page",
    type: "External Link",
    url: "https://solve.mit.edu/challenges",
    description: "Official MIT Solve challenge page with eligibility criteria and application timeline.",
    relatedGrantId: "g1",
    relatedGrantTitle: "MIT Solve",
    createdAt: "2026-04-20",
    isPublic: true,
    tags: ["mit solve", "eligibility", "reference"],
  },
];

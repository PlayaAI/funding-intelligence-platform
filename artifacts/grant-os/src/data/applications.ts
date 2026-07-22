export type ApplicationStatus =
  | "Draft"
  | "Writing"
  | "Internal Review"
  | "Ready to Submit"
  | "Submitted"
  | "Won"
  | "Rejected";

export interface ApplicationQuestion {
  id: string;
  question: string;
  wordLimit?: number;
  owner: string;
  status: "Not Started" | "Drafting" | "Draft Ready" | "Reviewed";
  draftAnswer?: string;
  finalAnswer?: string;
}

export interface RequiredDoc {
  id: string;
  name: string;
  status: "Missing" | "In Progress" | "Ready";
  url?: string;
  notes?: string;
}

export interface Application {
  id: string;
  grantId: string;
  grantTitle: string;
  funderName: string;
  projectSlug: string;
  projectName: string;
  owner: string;
  status: ApplicationStatus;
  deadline: string;
  submittedDate?: string;
  googleDocUrl?: string;
  googleDriveFolderUrl?: string;
  portalUrl?: string;
  internalNotes?: string;
  questions: ApplicationQuestion[];
  requiredDocs: RequiredDoc[];
  linkedProofItemIds: string[];
}

export const applications: Application[] = [
  {
    id: "a1",
    grantId: "g4",
    grantTitle: "Wellspring Foundation — Loneliness & Social Health",
    funderName: "Wellspring Foundation",
    projectSlug: "connect-app",
    projectName: "Connect App",
    owner: "Aaron Coombs",
    status: "Writing",
    deadline: "2026-05-30",
    googleDocUrl: "https://docs.google.com/document/d/placeholder",
    googleDriveFolderUrl: "https://drive.google.com/drive/folders/placeholder",
    internalNotes: "Sarah Chen (program officer) has seen our work. Warm relationship. Be specific about field testing numbers.",
    questions: [
      {
        id: "q1",
        question: "Describe your organization and the problem you are addressing.",
        wordLimit: 300,
        owner: "Aaron Coombs",
        status: "Draft Ready",
        draftAnswer: "Playa AI is a community technology group building tools for human connection and community flourishing. We address the epidemic of loneliness through technology that encourages authentic, face-to-face interaction rather than screen-mediated communication.",
        finalAnswer: "",
      },
      {
        id: "q2",
        question: "What is your theory of change? How does your work reduce social isolation?",
        wordLimit: 400,
        owner: "Aaron Coombs",
        status: "Drafting",
        draftAnswer: "",
        finalAnswer: "",
      },
      {
        id: "q3",
        question: "Describe your proof of concept and any community validation.",
        wordLimit: 400,
        owner: "Aaron Coombs",
        status: "Not Started",
        draftAnswer: "",
        finalAnswer: "",
      },
      {
        id: "q4",
        question: "What is your budget for this project and how will the grant funds be used?",
        wordLimit: 200,
        owner: "Aaron Coombs",
        status: "Not Started",
        draftAnswer: "",
        finalAnswer: "",
      },
    ],
    requiredDocs: [
      { id: "rd1", name: "Project Budget", status: "In Progress", notes: "Draft in progress" },
      { id: "rd2", name: "Letter of Support", status: "Missing", notes: "Need from community partner" },
      { id: "rd3", name: "Team Bios", status: "Ready" },
      { id: "rd4", name: "501c3 Status or Fiscal Sponsor Letter", status: "Missing", notes: "Exploring fiscal sponsorship with Fractured Atlas" },
    ],
    linkedProofItemIds: ["p1", "p5", "p8"],
  },
  {
    id: "a2",
    grantId: "g1",
    grantTitle: "MIT Solve — Indigenous Communities Fellowship",
    funderName: "MIT Solve",
    projectSlug: "connect-app",
    projectName: "Connect App",
    owner: "Aaron Coombs",
    status: "Draft",
    deadline: "2026-06-15",
    internalNotes: "Need to check exact eligibility. Consider reaching out to MIT Solve Slack community.",
    questions: [
      {
        id: "q5",
        question: "What problem are you solving and why does it matter now?",
        wordLimit: 250,
        owner: "Aaron Coombs",
        status: "Drafting",
        draftAnswer: "",
        finalAnswer: "",
      },
      {
        id: "q6",
        question: "Describe your solution and how it works.",
        wordLimit: 350,
        owner: "Aaron Coombs",
        status: "Not Started",
        draftAnswer: "",
        finalAnswer: "",
      },
    ],
    requiredDocs: [
      { id: "rd5", name: "Organization Overview", status: "Ready" },
      { id: "rd6", name: "Project Budget", status: "Missing" },
      { id: "rd7", name: "Team Overview", status: "Ready" },
    ],
    linkedProofItemIds: ["p1", "p6"],
  },
  {
    id: "a3",
    grantId: "g6",
    grantTitle: "Burning Man Project — Arts & Community Innovation",
    funderName: "Burning Man Project",
    projectSlug: "oracle",
    projectName: "Oracle Art Demo",
    owner: "Aaron Coombs",
    status: "Submitted",
    deadline: "2026-04-01",
    submittedDate: "2026-03-29",
    googleDocUrl: "https://docs.google.com/document/d/placeholder2",
    internalNotes: "Submitted on time. Strong application. Awaiting decision.",
    questions: [
      {
        id: "q7",
        question: "Describe your art project or community innovation.",
        wordLimit: 500,
        owner: "Aaron Coombs",
        status: "Drafting",
        draftAnswer: "Oracle is an interactive AI experience that blends contemplative tradition with experimental AI interaction design. Community members engage with an AI-generated oracle at community events, exploring reflection and meaning.",
        finalAnswer: "",
      },
    ],
    requiredDocs: [
      { id: "rd8", name: "Project Description", status: "Ready" },
      { id: "rd9", name: "Budget", status: "Ready" },
      { id: "rd10", name: "Photos/Demo", status: "Ready" },
    ],
    linkedProofItemIds: ["p3"],
  },
];

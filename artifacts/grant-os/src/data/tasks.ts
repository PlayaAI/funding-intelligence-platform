export type TaskStatus = "Not Started" | "In Progress" | "Waiting" | "Needs Review" | "Complete";
export type TaskPriority = "High" | "Medium" | "Low";

export interface Task {
  id: string;
  title: string;
  description?: string;
  owner: string;
  relatedGrantId?: string;
  relatedGrantTitle?: string;
  relatedProjectSlug?: string;
  relatedProjectName?: string;
  relatedApplicationId?: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Draft budget narrative for Wellspring application",
    description:
      "Create a clear, itemized budget for the Connect App grant application. Include personnel, technology costs, and community event costs.",
    owner: "Aaron Coombs",
    relatedGrantId: "g4",
    relatedGrantTitle: "Wellspring Foundation",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    relatedApplicationId: "a1",
    dueDate: "2026-05-20",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "t2",
    title: "Secure letter of support from community partner",
    description:
      "Reach out to community partner (Intentional Community Network contact) for a letter supporting the Connect App work.",
    owner: "Aaron Coombs",
    relatedGrantId: "g4",
    relatedGrantTitle: "Wellspring Foundation",
    relatedApplicationId: "a1",
    dueDate: "2026-05-22",
    status: "Not Started",
    priority: "High",
  },
  {
    id: "t3",
    title: "Research fiscal sponsorship options",
    description:
      "Evaluate Fractured Atlas, NFCB, and Open Collective as fiscal sponsorship options. Determine timeline and requirements.",
    owner: "Aaron Coombs",
    dueDate: "2026-05-25",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "t4",
    title: "Complete MIT Solve eligibility check",
    description:
      "Review MIT Solve challenge criteria in detail and confirm eligibility for current organizational structure.",
    owner: "Aaron Coombs",
    relatedGrantId: "g1",
    relatedGrantTitle: "MIT Solve",
    dueDate: "2026-05-28",
    status: "Not Started",
    priority: "High",
  },
  {
    id: "t5",
    title: "Draft Connect App theory of change section",
    description:
      "Write 400-word response explaining how Connect App's guided interaction model reduces loneliness and builds social capital.",
    owner: "Aaron Coombs",
    relatedGrantId: "g4",
    relatedGrantTitle: "Wellspring Foundation",
    relatedApplicationId: "a1",
    dueDate: "2026-05-21",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "t6",
    title: "Add Connect App field test session count to proof items",
    description:
      "Document the exact number of guided connection sessions completed during Burning Man 2024. Add to proof database.",
    owner: "Aaron Coombs",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    dueDate: "2026-05-18",
    status: "Not Started",
    priority: "Medium",
  },
  {
    id: "t7",
    title: "Research Knight Foundation program officer",
    description:
      "Identify the correct Knight Foundation program officer for civic technology grants and review their recent public statements.",
    owner: "Aaron Coombs",
    relatedGrantId: "g3",
    relatedGrantTitle: "Knight Foundation",
    dueDate: "2026-06-10",
    status: "Not Started",
    priority: "Medium",
  },
  {
    id: "t8",
    title: "Add Ikigai App proof items from March workshop",
    description:
      "Document the Ikigai Discovery Workshop outputs: participant count, feedback themes, and framework outputs.",
    owner: "Aaron Coombs",
    relatedProjectSlug: "ikigai",
    relatedProjectName: "Ikigai App",
    dueDate: "2026-06-01",
    status: "Not Started",
    priority: "Low",
  },
  {
    id: "t9",
    title: "Follow up with Wellspring — Sarah Chen",
    description:
      "Send a brief update note to Sarah Chen at Wellspring about application progress. Mention the fiscal sponsorship path.",
    owner: "Aaron Coombs",
    relatedGrantId: "g4",
    relatedGrantTitle: "Wellspring Foundation",
    dueDate: "2026-05-19",
    status: "Complete",
    priority: "High",
  },
  {
    id: "t10",
    title: "Review Mozilla Foundation open application requirements",
    description:
      "Download and review Mozilla Foundation grant program guidelines for current cycle. Note specific eligibility criteria.",
    owner: "Aaron Coombs",
    relatedGrantId: "g2",
    relatedGrantTitle: "Mozilla Foundation",
    dueDate: "2026-06-15",
    status: "Not Started",
    priority: "Medium",
  },
];

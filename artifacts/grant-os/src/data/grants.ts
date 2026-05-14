export type GrantStatus =
  | "Planned"
  | "Researching"
  | "Applying"
  | "Submitted"
  | "Awarded"
  | "Declined"
  | "Archived";

export interface Grant {
  id: string;
  title: string;
  funderId: string;
  funderName: string;
  deadline: string;
  amountMin: number;
  amountMax: number;
  focusAreas: string[];
  geography: string;
  eligibility: string;
  applicationUrl?: string;
  status: GrantStatus;
  assignedOwner: string;
  relatedProjectSlug?: string;
  relatedProjectName?: string;
  projectColor?: string;
  fitScore: number;
  priorityScore: number;
  urgencyScore: number;
  difficultyScore: number;
  notes?: string;
  nextTask?: string;
  isTop3: boolean;
}

export const grants: Grant[] = [
  {
    id: "g1",
    title: "MIT Solve — Indigenous Communities Fellowship",
    funderId: "f1",
    funderName: "MIT Solve",
    deadline: "2026-06-15",
    amountMin: 10000,
    amountMax: 150000,
    focusAreas: ["Community Technology", "Social Connection", "Indigenous Innovation"],
    geography: "Global",
    eligibility:
      "Social enterprises, nonprofits, and community organizations working at the intersection of technology and community flourishing.",
    applicationUrl: "https://solve.mit.edu/challenges",
    status: "Applying",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    projectColor: "#3B5BDB",
    fitScore: 88,
    priorityScore: 92,
    urgencyScore: 80,
    difficultyScore: 55,
    nextTask: "Complete eligibility check",
    notes:
      "Strong fit with human connection focus. Need to emphasize field testing at Burning Man and community validation.",
    isTop3: true,
  },
  {
    id: "g2",
    title: "Mozilla Foundation — Responsible Technology",
    funderId: "f2",
    funderName: "Mozilla Foundation",
    deadline: "2026-07-01",
    amountMin: 25000,
    amountMax: 50000,
    focusAreas: ["Humane Technology", "Privacy", "Digital Wellbeing"],
    geography: "Global / North America",
    eligibility:
      "Organizations building technology that centers human values, privacy, and wellbeing over engagement metrics.",
    status: "Researching",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    projectColor: "#3B5BDB",
    fitScore: 82,
    priorityScore: 78,
    urgencyScore: 65,
    difficultyScore: 45,
    nextTask: "Review program guidelines",
    isTop3: true,
    notes:
      "Excellent mission alignment. Connect App's 'put the phone down' feature is directly relevant.",
  },
  {
    id: "g3",
    title: "Knight Foundation — Tech for Engagement",
    funderId: "f3",
    funderName: "Knight Foundation",
    deadline: "2026-08-30",
    amountMin: 50000,
    amountMax: 300000,
    focusAreas: ["Civic Technology", "Community Engagement", "Innovation"],
    geography: "United States",
    eligibility:
      "Nonprofits and social enterprises using technology to strengthen community engagement and civic participation.",
    status: "Researching",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "ikigai",
    relatedProjectName: "Ikigai App",
    projectColor: "#7048E8",
    fitScore: 70,
    priorityScore: 65,
    urgencyScore: 40,
    difficultyScore: 60,
    nextTask: "Identify program officer",
    isTop3: false,
    notes:
      "Potentially good fit for the Ikigai app civic angle. Need to assess eligibility for unincorporated group.",
  },
  {
    id: "g4",
    title: "Wellspring Foundation — Loneliness & Social Health",
    funderId: "f4",
    funderName: "Wellspring Foundation",
    deadline: "2026-05-30",
    amountMin: 5000,
    amountMax: 25000,
    focusAreas: ["Loneliness", "Social Health", "Community"],
    geography: "California",
    eligibility:
      "Grassroots organizations and projects addressing social isolation and loneliness.",
    status: "Applying",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    projectColor: "#3B5BDB",
    fitScore: 90,
    priorityScore: 85,
    urgencyScore: 95,
    difficultyScore: 35,
    nextTask: "Complete budget narrative",
    isTop3: true,
    notes:
      "URGENT — deadline May 30. Draft 80% complete. Missing letters of support and budget narrative.",
  },
  {
    id: "g5",
    title: "Robert Wood Johnson Foundation — Health Equity",
    funderId: "f5",
    funderName: "Robert Wood Johnson Foundation",
    deadline: "2026-09-15",
    amountMin: 100000,
    amountMax: 500000,
    focusAreas: ["Health Equity", "Mental Health", "Community Wellbeing"],
    geography: "United States",
    eligibility: "501(c)(3) organizations with demonstrated impact in health equity.",
    status: "Planned",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "connect-app",
    relatedProjectName: "Connect App",
    projectColor: "#3B5BDB",
    fitScore: 65,
    priorityScore: 55,
    urgencyScore: 30,
    difficultyScore: 75,
    nextTask: "Research fiscal sponsorship",
    isTop3: false,
    notes: "Large grant but requires 501c3 status. Research fiscal sponsorship options.",
  },
  {
    id: "g6",
    title: "Burning Man Project — Arts & Community Innovation",
    funderId: "f6",
    funderName: "Burning Man Project",
    deadline: "2026-04-01",
    amountMin: 1000,
    amountMax: 15000,
    focusAreas: ["Arts", "Community Innovation", "Participatory Culture"],
    geography: "Black Rock City / Global",
    eligibility: "Community projects connected to Burning Man culture and principles.",
    applicationUrl: "https://burningman.org/grants",
    status: "Submitted",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "oracle",
    relatedProjectName: "Oracle Art Demo",
    projectColor: "#E67700",
    fitScore: 85,
    priorityScore: 72,
    urgencyScore: 100,
    difficultyScore: 30,
    isTop3: false,
    notes: "Application submitted April 1. Awaiting decision. Strong proof from 2024 demo.",
  },
  {
    id: "g7",
    title: "NEA — Technology & Human Flourishing",
    funderId: "f7",
    funderName: "National Endowment for the Arts",
    deadline: "2026-10-15",
    amountMin: 10000,
    amountMax: 100000,
    focusAreas: ["Arts", "Technology", "Community Participation"],
    geography: "United States",
    eligibility:
      "Arts organizations and projects at the intersection of technology and community arts.",
    status: "Planned",
    assignedOwner: "Aaron Coombs",
    relatedProjectSlug: "oracle",
    relatedProjectName: "Oracle Art Demo",
    projectColor: "#E67700",
    fitScore: 60,
    priorityScore: 50,
    urgencyScore: 25,
    difficultyScore: 65,
    isTop3: false,
  },
  {
    id: "g8",
    title: "MacArthur Foundation — Field Initiative",
    funderId: "f8",
    funderName: "MacArthur Foundation",
    deadline: "2026-11-01",
    amountMin: 250000,
    amountMax: 1000000,
    focusAreas: ["Social Innovation", "Technology", "Equity"],
    geography: "Global",
    eligibility:
      "By invitation or letter of inquiry. Established organizations with demonstrated field leadership.",
    status: "Archived",
    assignedOwner: "Aaron Coombs",
    fitScore: 50,
    priorityScore: 30,
    urgencyScore: 20,
    difficultyScore: 90,
    isTop3: false,
    notes: "Likely out of scope for current stage. Archived for future consideration.",
  },
  {
    id: "g9",
    title: "State Dept. — Democracy & Civic Technology",
    funderId: "f9",
    funderName: "U.S. Department of State",
    deadline: "2025-12-01",
    amountMin: 50000,
    amountMax: 200000,
    focusAreas: ["Democracy", "Civic Technology", "Digital Rights"],
    geography: "United States",
    eligibility: "Nonprofits and social enterprises in civic technology space.",
    status: "Declined",
    assignedOwner: "Aaron Coombs",
    fitScore: 55,
    priorityScore: 40,
    urgencyScore: 0,
    difficultyScore: 80,
    isTop3: false,
    notes: "Missed deadline — submitted too late. Important lesson for future applications.",
  },
];

export const grantStatusColors: Record<GrantStatus, string> = {
  Planned: "bg-slate-100 text-slate-600 border-slate-200",
  Researching: "bg-blue-50 text-blue-700 border-blue-200",
  Applying: "bg-violet-50 text-violet-700 border-violet-200",
  Submitted: "bg-amber-50 text-amber-700 border-amber-200",
  Awarded: "bg-green-50 text-green-700 border-green-200",
  Declined: "bg-red-50 text-red-700 border-red-200",
  Archived: "bg-gray-100 text-gray-500 border-gray-200",
};

export const PROJECT_COLORS: Record<string, string> = {
  "connect-app": "#3B5BDB",
  ikigai: "#7048E8",
  "bm-packing": "#2F9E44",
  "biohack-burn": "#1971C2",
  oracle: "#E67700",
  "relationship-tool": "#C2255C",
};

export interface Funder {
  id: string;
  /** Route-friendly legacy id (e.g. f4) when seeded from mock data */
  legacyId?: string;
  name: string;
  ein?: string;
  website?: string;
  location: string;
  totalAssets?: string;
  annualGiving?: string;
  medianGrantAmount: number;
  givingCategories: string[];
  openApplications: boolean;
  relationshipStatus: "None" | "Researching" | "Contacted" | "In Conversation" | "Active Relationship";
  pastGrantees?: string[];
  notes?: string;
  relatedGrantIds: string[];
  peerConnections: number;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
}

/**
 * @deprecated Use Supabase via `useMappedFunders` / `fundersService`. Kept for static fallbacks and tests.
 */
export const funders: Funder[] = [
  {
    id: "f1",
    name: "MIT Solve",
    website: "https://solve.mit.edu",
    location: "Cambridge, MA",
    annualGiving: "$2M+",
    medianGrantAmount: 75000,
    givingCategories: ["Community Technology", "Social Innovation", "Global Health", "Climate"],
    openApplications: true,
    relationshipStatus: "Researching",
    pastGrantees: ["GiveDirectly", "Nori Carbon", "Healtheon"],
    relatedGrantIds: ["g1"],
    peerConnections: 3,
    notes: "Open challenge model. Strong emphasis on scalable technology for underserved communities.",
  },
  {
    id: "f2",
    name: "Mozilla Foundation",
    ein: "20-0097189",
    website: "https://foundation.mozilla.org",
    location: "Mountain View, CA",
    annualGiving: "$15M+",
    medianGrantAmount: 35000,
    givingCategories: ["Humane Technology", "Privacy", "Open Web", "Digital Rights"],
    openApplications: true,
    relationshipStatus: "Researching",
    pastGrantees: ["Electronic Frontier Foundation", "Access Now", "The Markup"],
    relatedGrantIds: ["g2"],
    peerConnections: 5,
    notes: "Awards grants to orgs building ethical, user-respecting technology. Strong value alignment.",
    contactName: "Bridget Bauer",
    contactTitle: "Program Officer, Technology & Society",
    contactEmail: "grants@mozillafoundation.org",
  },
  {
    id: "f3",
    name: "Knight Foundation",
    ein: "65-0464177",
    website: "https://knightfoundation.org",
    location: "Miami, FL",
    totalAssets: "$2.5B",
    annualGiving: "$80M+",
    medianGrantAmount: 125000,
    givingCategories: ["Journalism", "Civic Technology", "Community Engagement", "Arts"],
    openApplications: false,
    relationshipStatus: "Researching",
    pastGrantees: ["Code for America", "Wikimedia Foundation", "ProPublica"],
    relatedGrantIds: ["g3"],
    peerConnections: 2,
    notes: "Large foundation. Must identify program officer contact. Civic tech angle most relevant.",
    contactName: "Sam Gill",
    contactTitle: "VP, Community & National Initiatives",
    contactEmail: "grants@knightfoundation.org",
  },
  {
    id: "f4",
    name: "Wellspring Foundation",
    website: "https://wellspringfoundation.org",
    location: "San Francisco, CA",
    annualGiving: "$1.5M",
    medianGrantAmount: 12500,
    givingCategories: ["Loneliness", "Social Health", "Mental Health", "Community"],
    openApplications: true,
    relationshipStatus: "In Conversation",
    relatedGrantIds: ["g4"],
    peerConnections: 4,
    notes: "Program officer Sarah Chen is aware of our work. Warm intro via network connection.",
    contactName: "Sarah Chen",
    contactTitle: "Program Officer",
    contactEmail: "sarah.chen@wellspringfoundation.org",
  },
  {
    id: "f5",
    name: "Robert Wood Johnson Foundation",
    ein: "22-1807327",
    website: "https://rwjf.org",
    location: "Princeton, NJ",
    totalAssets: "$12B",
    annualGiving: "$600M+",
    medianGrantAmount: 250000,
    givingCategories: ["Health Equity", "Public Health", "Mental Health", "Social Determinants"],
    openApplications: false,
    relationshipStatus: "None",
    relatedGrantIds: ["g5"],
    peerConnections: 1,
    notes: "Major funder. Need 501c3 status or fiscal sponsor to apply.",
  },
  {
    id: "f6",
    name: "Burning Man Project",
    ein: "74-3177354",
    website: "https://burningman.org",
    location: "San Francisco, CA",
    annualGiving: "$500K",
    medianGrantAmount: 5000,
    givingCategories: ["Arts", "Community Innovation", "Participatory Culture"],
    openApplications: true,
    relationshipStatus: "Active Relationship",
    pastGrantees: ["Multiple community art projects"],
    relatedGrantIds: ["g6"],
    peerConnections: 8,
    notes: "Strong community relationship. Multiple team members deeply embedded in Burning Man culture.",
    contactName: "Marian Goodell",
    contactTitle: "Chief Executive Officer",
    contactEmail: "grants@burningman.org",
  },
  {
    id: "f7",
    name: "National Endowment for the Arts",
    ein: "52-0858440",
    website: "https://arts.gov",
    location: "Washington, DC",
    annualGiving: "$180M",
    medianGrantAmount: 25000,
    givingCategories: ["Arts", "Technology & Arts", "Community Arts", "Cultural Preservation"],
    openApplications: true,
    relationshipStatus: "Researching",
    relatedGrantIds: ["g7"],
    peerConnections: 0,
  },
  {
    id: "f8",
    name: "MacArthur Foundation",
    ein: "23-7093598",
    website: "https://macfound.org",
    location: "Chicago, IL",
    totalAssets: "$7.5B",
    annualGiving: "$260M",
    medianGrantAmount: 500000,
    givingCategories: ["Social Innovation", "Technology", "Equity", "Climate", "Criminal Justice"],
    openApplications: false,
    relationshipStatus: "None",
    relatedGrantIds: ["g8"],
    peerConnections: 0,
    notes: "Primarily by invitation. Long-term aspiration. Would need significant organizational growth.",
  },
  {
    id: "f9",
    name: "U.S. Department of State",
    website: "https://state.gov",
    location: "Washington, DC",
    annualGiving: "$500M+",
    medianGrantAmount: 100000,
    givingCategories: ["Democracy", "Civic Technology", "Digital Rights", "International Development"],
    openApplications: false,
    relationshipStatus: "None",
    relatedGrantIds: ["g9"],
    peerConnections: 0,
    notes: "Missed deadline on this cycle. Complex application process. Monitor for future cycles.",
  },
];

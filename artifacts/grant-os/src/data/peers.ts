export interface FundingRecord {
  id: string;
  funderName: string;
  year: number;
  amount: number;
  notes?: string;
}

export interface SavedOpportunity {
  title: string;
  funderName: string;
  deadline: string;
  relevance: string;
}

export interface PeerOrg {
  id: string;
  /** Route-friendly legacy id (e.g. po1) when seeded from mock data */
  legacyId?: string;
  name: string;
  ein?: string;
  website?: string;
  description: string;
  location: string;
  focusAreas: string[];
  fundingRecords: FundingRecord[];
  notes?: string;
  relevance: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  savedOpportunities?: SavedOpportunity[];
}

/**
 * @deprecated Use Supabase via `useMappedPeers` / `peersService`. Kept for static fallbacks and tests.
 */
export const peerOrgs: PeerOrg[] = [
  {
    id: "po1",
    name: "Touchy-Feely Tech",
    ein: "87-1234501",
    website: "https://touchyfeely.tech",
    description: "A nonprofit building humane technology products focused on authentic human connection and reducing social isolation.",
    location: "San Francisco, CA",
    focusAreas: ["Humane Technology", "Social Connection", "Community Wellbeing"],
    fundingRecords: [
      { id: "fr1", funderName: "Mozilla Foundation", year: 2023, amount: 40000, notes: "Humane tech grant" },
      { id: "fr2", funderName: "Wellspring Foundation", year: 2024, amount: 15000 },
    ],
    notes: "Very close mission alignment with Connect App. Sharing funder intelligence would be mutually beneficial.",
    relevance: "Direct peer in humane technology space. Has relationships with Mozilla and Wellspring.",
    contactName: "Amber Rose",
    contactTitle: "Executive Director",
    contactEmail: "amber@touchyfeely.tech",
    savedOpportunities: [
      { title: "Humane Tech Small Grants Program", funderName: "Center for Humane Technology", deadline: "2026-07-15", relevance: "Direct mission alignment — they fund smaller orgs in this space." },
    ],
  },
  {
    id: "po2",
    name: "Center for Humane Technology",
    ein: "82-4190453",
    website: "https://humanetech.com",
    description: "A nonprofit working to reverse the harms of social media and technology through advocacy, policy, and education.",
    location: "San Francisco, CA",
    focusAreas: ["Humane Technology", "Digital Wellbeing", "Advocacy", "Policy"],
    fundingRecords: [
      { id: "fr3", funderName: "Knight Foundation", year: 2022, amount: 500000 },
      { id: "fr4", funderName: "Mozilla Foundation", year: 2023, amount: 75000 },
      { id: "fr5", funderName: "MacArthur Foundation", year: 2023, amount: 1200000 },
    ],
    notes: "Larger org, but strong funder alignment. Their MacArthur funding shows MacArthur interest in this space.",
    relevance: "Funder intelligence: Mozilla and Knight both fund humane tech organizations.",
    contactName: "Tristan Harris",
    contactTitle: "Co-Founder",
    contactEmail: "info@humanetech.com",
    savedOpportunities: [
      { title: "Knight Civic Tech Challenge", funderName: "Knight Foundation", deadline: "2026-09-01", relevance: "CHT received Knight funding — this validates the channel for humane tech advocacy work." },
      { title: "MacArthur 100&Change", funderName: "MacArthur Foundation", deadline: "2027-01-15", relevance: "Long shot but their MacArthur award shows MacArthur is interested in this space at scale." },
    ],
  },
  {
    id: "po3",
    name: "Cosmic Seed",
    ein: "47-2891033",
    website: "https://cosmicseed.org",
    description: "A community-centered organization that uses immersive and participatory experiences to build social capital and community resilience.",
    location: "Los Angeles, CA",
    focusAreas: ["Community Building", "Participatory Culture", "Social Capital", "Arts"],
    fundingRecords: [
      { id: "fr6", funderName: "Burning Man Project", year: 2024, amount: 8000 },
      { id: "fr7", funderName: "NEA", year: 2023, amount: 20000 },
    ],
    notes: "Strong community in Burning Man adjacent culture. Overlapping network.",
    relevance: "Both funded by Burning Man Project and NEA. Community building parallel to our workshops.",
    contactName: "Maya Stardust",
    contactTitle: "Programs Director",
    contactEmail: "maya@cosmicseed.org",
    savedOpportunities: [
      { title: "NEA Art Works — Community Engagement", funderName: "National Endowment for the Arts", deadline: "2026-08-10", relevance: "Cosmic Seed received NEA funding — validates NEA as a viable funder for community arts/tech." },
    ],
  },
  {
    id: "po4",
    name: "Wellbeing Collective",
    ein: "83-0742811",
    website: "https://wellbeingcollective.org",
    description: "A grassroots collective creating programs and tools to address social isolation and loneliness, particularly for young adults.",
    location: "Berkeley, CA",
    focusAreas: ["Loneliness", "Mental Health", "Youth Wellbeing", "Community"],
    fundingRecords: [
      { id: "fr8", funderName: "Wellspring Foundation", year: 2023, amount: 20000 },
      { id: "fr9", funderName: "Robert Wood Johnson Foundation", year: 2024, amount: 150000, notes: "Health equity initiative" },
    ],
    notes: "Has received both Wellspring and RWJF funding. Proof that RWJF funds this type of work.",
    relevance: "Critical: validates that RWJF funds social health work from smaller orgs with fiscal sponsors.",
    contactName: "Jordan Park",
    contactTitle: "Co-Director",
    contactEmail: "jordan@wellbeingcollective.org",
    savedOpportunities: [
      { title: "RWJF Health Equity Grant", funderName: "Robert Wood Johnson Foundation", deadline: "2026-10-01", relevance: "Their RWJF award confirms RWJF will fund orgs at our stage if we have a fiscal sponsor." },
    ],
  },
  {
    id: "po5",
    name: "Purpose Lab",
    ein: "46-5318290",
    website: "https://purposelab.org",
    description: "A reflective practice organization helping individuals and communities discover purpose through structured workshop methodologies.",
    location: "Portland, OR",
    focusAreas: ["Purpose", "Self-Discovery", "Wellbeing", "Education"],
    fundingRecords: [
      { id: "fr10", funderName: "Knight Foundation", year: 2023, amount: 75000 },
      { id: "fr11", funderName: "Wellspring Foundation", year: 2023, amount: 18000 },
    ],
    notes: "Strong parallel to Ikigai App. Knight Foundation funded their civic engagement angle.",
    relevance: "Validates Knight Foundation and Wellspring as funders for purpose/wellbeing work.",
    contactName: "Devon Hazel",
    contactTitle: "Founder & Director",
    contactEmail: "devon@purposelab.org",
    savedOpportunities: [
      { title: "Knight Community Information Challenge", funderName: "Knight Foundation", deadline: "2026-11-15", relevance: "They received Knight funding for purpose/civic work — same lane as our Ikigai App." },
      { title: "Wellspring Social Health Grant", funderName: "Wellspring Foundation", deadline: "2026-06-30", relevance: "Purpose Lab + Wellspring = validated path for purpose-driven wellbeing work." },
    ],
  },
];

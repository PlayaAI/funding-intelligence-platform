export type ProofItemType = "workshop" | "app_demo" | "document" | "metric" | "testimonial";

export interface ProofItem {
  id: string;
  title: string;
  type: ProofItemType;
  projectSlug?: string;
  projectName?: string;
  description: string;
  date?: string;
  tags: string[];
  isPublic?: boolean;
  grantRelevance?: string;
}

export const proofItems: ProofItem[] = [
  {
    id: "p1",
    title: "Connect App Field Sessions — Burning Man 2024",
    type: "app_demo",
    projectSlug: "connect-app",
    projectName: "Connect App",
    description:
      "Live field testing of the guided connection protocol with community participants during Burning Man 2024. Multiple sessions completed in a real-world intentional community setting with positive qualitative feedback.",
    date: "August 2024",
    tags: ["human connection", "field test", "humane technology"],
    isPublic: true,
    grantRelevance: "Primary proof of concept for Wellspring Foundation and MIT Solve applications — demonstrates real-world community validation of the core connection methodology.",
  },
  {
    id: "p2",
    title: "Biohack Your Burn Workshop",
    type: "workshop",
    projectSlug: "biohack-burn",
    projectName: "Biohack Your Burn",
    description:
      "Pre-event workshop covering sleep optimization, nutrition, heat adaptation, and community care strategies for Burning Man participants. Delivered in-person with workshop guide produced.",
    date: "July 2024",
    tags: ["wellness", "workshop", "education"],
    isPublic: true,
    grantRelevance: "Demonstrates organizational capacity to design and deliver structured educational workshops — relevant to NEA and community grant applications.",
  },
  {
    id: "p3",
    title: "Oracle AI Art Demo — Community Showcase",
    type: "app_demo",
    projectSlug: "oracle",
    projectName: "Oracle Art Demo",
    description:
      "Public demonstration of the Oracle interactive experience. Community members engaged with AI-generated contemplative responses at a community gathering. Live demo validated the interaction concept.",
    date: "June 2024",
    tags: ["AI art", "interactive experience", "culture"],
    isPublic: true,
    grantRelevance: "Key proof item for Burning Man Project arts grant — shows publicly demonstrated interactive art with community participation.",
  },
  {
    id: "p4",
    title: "Burning Man Packing List — Published Resource",
    type: "document",
    projectSlug: "bm-packing",
    projectName: "Burning Man Packing List",
    description:
      "A comprehensive, community-tested preparation guide published and distributed to participants. Covers safety, community norms, leave no trace principles, and practical preparation.",
    tags: ["community utility", "documentation", "participant support"],
    isPublic: true,
    grantRelevance: "Demonstrates ability to produce and distribute community utility resources — useful for general organizational capacity proof.",
  },
  {
    id: "p5",
    title: "Playa AI Workshop Series (2023–2024)",
    type: "workshop",
    description:
      "A series of community workshops where participants collaborated to build technology experiments, tools, and prototypes rooted in community values. Led to multiple project launches.",
    date: "2023–2024",
    tags: ["community", "learning", "project incubation"],
    isPublic: true,
    grantRelevance: "Strong proof of community engagement capacity — relevant for Mozilla Foundation, Wellspring, and Knight Foundation applications.",
  },
  {
    id: "p6",
    title: "Connect App — Session Protocol Documentation",
    type: "document",
    projectSlug: "connect-app",
    projectName: "Connect App",
    description:
      "Detailed documentation of the guided connection session protocol, including question frameworks, session structure, facilitator notes, and design rationale.",
    tags: ["methodology", "documentation", "design"],
    isPublic: false,
    grantRelevance: "Internal methodology documentation — attach to grant applications requiring proof of a structured program model (MIT Solve, Wellspring).",
  },
  {
    id: "p7",
    title: "Ikigai Discovery Workshop",
    type: "workshop",
    projectSlug: "ikigai",
    projectName: "Ikigai App",
    description:
      "A facilitated group workshop walking participants through the Ikigai framework for discovering purpose and community contribution. Tested the core reflective methodology.",
    date: "March 2024",
    tags: ["purpose", "wellbeing", "workshop"],
    isPublic: true,
    grantRelevance: "Validates the Ikigai app methodology with real participants — relevant to Knight Foundation civic tech and purpose-driven wellbeing grants.",
  },
  {
    id: "p8",
    title: "12+ Community Events Hosted",
    type: "metric",
    description:
      "Over a dozen community events, workshops, and gatherings hosted across 2023 and 2024, bringing together technologists, artists, and community builders.",
    date: "2023–2024",
    tags: ["impact", "community", "scale"],
    isPublic: true,
    grantRelevance: "High-impact metric for all applications — demonstrates consistent community engagement and organizational momentum over multiple years.",
  },
  {
    id: "p9",
    title: "Biohack Your Burn — Published Guide",
    type: "document",
    projectSlug: "biohack-burn",
    projectName: "Biohack Your Burn",
    description:
      "A written guide published from the workshop, covering evidence-based approaches to physical and mental wellbeing at large-scale participatory events.",
    tags: ["wellness", "documentation", "community education"],
    isPublic: true,
    grantRelevance: "Shows ability to translate workshop delivery into reusable public resources — useful for capacity documentation in NEA and community grants.",
  },
];

export const proofTypeLabels: Record<ProofItemType, string> = {
  workshop: "Workshop",
  app_demo: "App Demo",
  document: "Document",
  metric: "Metric",
  testimonial: "Testimonial",
};

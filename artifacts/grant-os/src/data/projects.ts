export interface Project {
  slug: string;
  name: string;
  category: string;
  status: "Active" | "Live" | "Prototype" | "Published" | "Demo Complete" | "Early Prototype";
  statusVariant: "active" | "live" | "prototype" | "published";
  summary: string;
  problem?: string;
  audience?: string;
  grantRelevance: string;
  proofCount: number;
  featured: boolean;
}

export const projects: Project[] = [
  {
    slug: "connect-app",
    name: "Connect App",
    category: "Human Connection Technology",
    status: "Active",
    statusVariant: "active",
    summary:
      "A guided interaction tool that helps people connect more meaningfully — with someone they're meeting for the first time, or someone they already know. It prompts deeper questions and eventually asks both people to put the phone down.",
    problem:
      "Most social interactions remain shallow, fragmented, and screen-mediated, even when people are physically present together.",
    audience: "Intentional communities, event participants, workshop attendees, people seeking deeper connection.",
    grantRelevance: "Social cohesion, loneliness reduction, community building, humane technology",
    proofCount: 4,
    featured: true,
  },
  {
    slug: "ikigai",
    name: "Ikigai App",
    category: "Self-Discovery / Purpose",
    status: "Prototype",
    statusVariant: "prototype",
    summary:
      "A reflective tool guiding people through the Ikigai framework to clarify their purpose, strengths, and meaningful contribution to the community.",
    grantRelevance: "Human flourishing, education, wellbeing, reflective practice",
    proofCount: 2,
    featured: true,
  },
  {
    slug: "bm-packing",
    name: "Burning Man Packing List",
    category: "Community Utility",
    status: "Live",
    statusVariant: "live",
    summary:
      "A practical, community-tested preparation guide helping Burning Man participants show up ready, safe, and community-minded.",
    grantRelevance: "Community infrastructure, participant support, civic participation",
    proofCount: 2,
    featured: true,
  },
  {
    slug: "biohack-burn",
    name: "Biohack Your Burn",
    category: "Wellness / Education",
    status: "Published",
    statusVariant: "published",
    summary:
      "A workshop and published guide for optimizing wellbeing at large-scale participatory events using evidence-based approaches to sleep, nutrition, heat adaptation, and community care.",
    grantRelevance: "Wellbeing, community education, workshop outputs, public health",
    proofCount: 3,
    featured: false,
  },
  {
    slug: "oracle",
    name: "Oracle Art Demo",
    category: "AI Art / Interactive Experience",
    status: "Demo Complete",
    statusVariant: "published",
    summary:
      "An interactive experience where participants speak with an AI-powered Oracle — blending contemplative tradition with experimental AI interaction design at community events.",
    grantRelevance: "Arts and technology, interactive AI, cultural experimentation, creative community",
    proofCount: 2,
    featured: false,
  },
  {
    slug: "relationship-tool",
    name: "Relationship Support Tool",
    category: "Relationship Maintenance",
    status: "Early Prototype",
    statusVariant: "prototype",
    summary:
      "A lightweight tool helping people maintain meaningful relationships through gentle reminders, check-ins, and contextual prompts.",
    grantRelevance: "Connection, social support, community continuity, mental health",
    proofCount: 1,
    featured: false,
  },
];

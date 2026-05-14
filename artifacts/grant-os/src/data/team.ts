export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  expertise: string[];
  type: "core" | "advisor";
}

export const teamMembers: TeamMember[] = [
  {
    id: "t1",
    name: "Alex",
    role: "Grant Strategy & Community Lead",
    bio: "Leads organizational strategy, grant development, and community partnerships. Focuses on connecting technology projects with the funding landscape and building long-term organizational capacity. Has facilitated community gatherings and intentional events over several years.",
    expertise: ["Grant strategy", "Community building", "Organizational development", "Event facilitation"],
    type: "core",
  },
  {
    id: "t2",
    name: "Rebecca",
    role: "Research & Documentation",
    bio: "Leads grant research, document preparation, and funder intelligence. Brings rigor and structure to the application process, maintains institutional knowledge, and ensures submissions are evidence-based and clearly articulated.",
    expertise: ["Grant research", "Document preparation", "Funder intelligence", "Writing"],
    type: "core",
  },
  {
    id: "t3",
    name: "Raed",
    role: "Technical Lead",
    bio: "Leads technical development, automation workflows, and data systems. Builds the tools the community uses and explores new approaches to AI-assisted community technology. Has built multiple working prototypes across the Playa AI project portfolio.",
    expertise: ["Software development", "AI systems", "Data workflows", "Prototype development"],
    type: "core",
  },
  {
    id: "a1",
    name: "Aaron Coombs",
    role: "Contributor — Relationship Tool",
    bio: "Creator of the Relationship Support Tool prototype, which emerged from the Playa AI Build Sprint. Brings experience in relationship design and human-centered product development.",
    expertise: ["Product design", "Relationship technology", "Human-centered design"],
    type: "advisor",
  },
  {
    id: "a2",
    name: "Community Advisor — Nonprofit Strategy",
    role: "Advisor (in formation)",
    bio: "We are forming an advisory relationship with a nonprofit grants strategist with experience in community foundations and arts/technology funders. Name and affiliation to be confirmed once the formal relationship is established.",
    expertise: ["Nonprofit operations", "Foundation strategy", "Grant writing"],
    type: "advisor",
  },
];

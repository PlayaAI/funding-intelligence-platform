export interface Workshop {
  id: string;
  title: string;
  date: string;
  location: string;
  summary: string;
  outputs: string[];
  projectSlugs: string[];
  projectNames: string[];
}

export const workshops: Workshop[] = [
  {
    id: "w1",
    title: "Connect App Field Sessions",
    date: "August 2024",
    location: "Black Rock City, NV",
    summary:
      "Live field testing of the Connect App guided interaction protocol with community participants during Burning Man 2024. Real-world validation in an intentional community setting with high participant engagement.",
    outputs: [
      "Multiple guided sessions completed",
      "Qualitative feedback collected from participants",
      "Protocol refinements documented",
      "Field notes archived",
    ],
    projectSlugs: ["connect-app"],
    projectNames: ["Connect App"],
  },
  {
    id: "w2",
    title: "Biohack Your Burn",
    date: "July 2024",
    location: "San Francisco, CA",
    summary:
      "Pre-event workshop helping Burning Man participants optimize physical and mental readiness using evidence-based approaches to sleep, nutrition, heat adaptation, and community care. Led to a published guide distributed to participants.",
    outputs: [
      "Full workshop guide produced",
      "Published community resource",
      "Community toolkit distributed",
      "Workshop video recorded",
    ],
    projectSlugs: ["biohack-burn"],
    projectNames: ["Biohack Your Burn"],
  },
  {
    id: "w3",
    title: "Ikigai Discovery Workshop",
    date: "March 2024",
    location: "San Francisco, CA",
    summary:
      "A facilitated group workshop using the Ikigai framework to help participants articulate their purpose, strengths, and contribution to their communities. Tested the core methodology that became the Ikigai App.",
    outputs: [
      "Participant reflection materials developed",
      "Facilitation guide documented",
      "App design informed by session",
    ],
    projectSlugs: ["ikigai"],
    projectNames: ["Ikigai App"],
  },
  {
    id: "w4",
    title: "Playa AI Build Sprint",
    date: "2023",
    location: "San Francisco, CA",
    summary:
      "An intensive community workshop series where participants collaborated to build technology experiments and tools rooted in community values. Led to the Oracle art demo and Relationship Support Tool prototypes, and established the core team's working methodology.",
    outputs: [
      "Multiple working prototypes produced",
      "Oracle AI art demo launched",
      "Relationship Support Tool prototyped",
      "Community methodology documented",
    ],
    projectSlugs: ["oracle", "relationship-tool"],
    projectNames: ["Oracle Art Demo", "Relationship Support Tool"],
  },
];

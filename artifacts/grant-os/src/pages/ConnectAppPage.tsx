import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Users, MessageCircle, Eye, PhoneOff, Shield } from "lucide-react";
import StatusBadge from "@/components/public/StatusBadge";

const steps = [
  {
    icon: <Users className="w-5 h-5 text-primary" />,
    title: "Two people open the app",
    description: "The session begins when both participants choose to start a guided connection experience together.",
  },
  {
    icon: <MessageCircle className="w-5 h-5 text-primary" />,
    title: "Guided prompts surface deeper questions",
    description: "The app presents a structured sequence of questions that move from surface-level to more meaningful territory, paced to the conversation.",
  },
  {
    icon: <Eye className="w-5 h-5 text-primary" />,
    title: "The session invites presence",
    description: "As the conversation deepens, the app encourages participants to be more present with each other — reducing screen reliance mid-conversation.",
  },
  {
    icon: <PhoneOff className="w-5 h-5 text-primary" />,
    title: "Put the phone down",
    description: "The session ends by asking both people to put the phone down and look at each other. Technology steps back once it's done its job.",
  },
];

const proofItems = [
  "Live field sessions conducted at Burning Man 2024 in Black Rock City",
  "Guided session protocol documented and iterated on across multiple sessions",
  "Qualitative feedback collected from participants across different session types",
  "Protocol design reviewed and refined by the core team",
];

const grantRelevancePoints = [
  "Social cohesion and loneliness reduction — directly addresses the epidemic of shallow digital interaction",
  "Humane technology — technology that serves human connection rather than extracting from it",
  "Community building — validated in intentional community settings",
  "Behavioral health — structured experiences that improve quality of in-person time",
  "Strong alignment with MIT Solve Global Challenge framing around technology + social problem + community operation",
];

export default function ConnectAppPage() {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/projects" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" />
            All projects
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative py-16 sm:py-24 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #1e40af 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <StatusBadge label="Active — Field Testing" variant="active" />
            <StatusBadge label="Flagship Project" variant="published" />
            <span className="text-xs border border-border rounded-full px-2.5 py-0.5 text-muted-foreground bg-white">
              Human Connection Technology
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-foreground leading-[1.05] tracking-tight max-w-3xl">
            Connect App
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            A guided interaction tool that helps two people connect more meaningfully — with someone they're meeting for the first time, or someone they already know.
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            It prompts deeper questions, slows the interaction down, and eventually asks both people to put the phone down and look into each other's eyes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/proof"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 shadow-sm"
            >
              View proof items
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-foreground font-semibold text-sm hover:bg-secondary"
              data-testid="connect-app-contact-cta"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="py-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">The problem</p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-5">Most social interactions stay shallow</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Even when people are physically present together, social interactions are increasingly fragmented, distracted, and device-mediated. We scroll, half-listen, and move on — rarely making real contact with the people in front of us.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The loneliness epidemic is not just about being alone. It's about failing to connect even when we're together. There's no shortage of social events or networking opportunities — there's a shortage of structured experiences that help people actually reach each other.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-7">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Context</p>
              </div>
              <ul className="space-y-4">
                {[
                  "The US Surgeon General named loneliness a public health crisis in 2023",
                  "Most existing social apps optimize for engagement, not connection",
                  "Intentional communities already know how to create connection — the tools can spread the practice",
                  "Short, structured shared experiences are proven to build trust and closeness",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-b border-border bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">How it works</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-10">The guided interaction flow</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 relative hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mb-4">
                  {i + 1}
                </div>
                <div className="mb-3">{step.icon}</div>
                <h3 className="font-bold text-foreground text-sm mb-2 leading-snug">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-primary/5 border border-primary/10 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Design principle:</span>{" "}
                Technology should do its job and then get out of the way. The Connect App is successful when people put it down.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community proof */}
      <section className="py-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Community usage</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">Tested in real community settings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <ul className="space-y-4">
              {proofItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b border-border px-6 py-4">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Proof status</p>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: "Field sessions", value: "Conducted", status: "done" },
                  { label: "Protocol documentation", value: "Complete", status: "done" },
                  { label: "Qualitative feedback", value: "Collected", status: "done" },
                  { label: "Session count metrics", value: "In progress", status: "progress" },
                  { label: "Screenshots / media", value: "To be added", status: "pending" },
                  { label: "User testimonials", value: "To be collected", status: "pending" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      row.status === "done" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      row.status === "progress" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-secondary text-muted-foreground border border-border"
                    }`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot placeholder */}
      <section className="py-16 border-b border-border bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">App screens</p>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-8">Interface</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {["Session start", "Guided prompts", "Closing moment"].map((screen) => (
              <div
                key={screen}
                className="bg-slate-100 border border-dashed border-slate-300 rounded-2xl overflow-hidden flex flex-col items-center justify-end pb-6 pt-0"
                style={{ minHeight: "220px" }}
              >
                <div className="w-full h-full flex items-center justify-center flex-1 mb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <div className="w-5 h-5 rounded bg-slate-300" />
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500">{screen}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Screenshot placeholder</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Grant relevance */}
      <section className="py-16 border-b border-border bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-4 h-px bg-blue-400" />
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Grant relevance</p>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-7">Why funders should care</h2>
            <ul className="space-y-4">
              {grantRelevancePoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Next evolution */}
      <section className="py-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Next evolution</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-5">From connection to ongoing relationship</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <p className="text-muted-foreground leading-relaxed mb-5">
                The Connect App creates a moment of genuine connection. The natural next step is helping people maintain that connection over time. A companion Relationship Support Tool would help people:
              </p>
              <ul className="space-y-3">
                {[
                  "Track the people they care about and when they last connected",
                  "Get gentle reminders before relationships go dormant",
                  "Return to the shared experience from their Connect App session",
                  "Build and sustain community relationships across time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <ArrowRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-7">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Current status</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                The Relationship Support Tool is in early prototype stage. The methodology from the Connect App provides a strong foundation for the next layer of the connection journey.
              </p>
              <Link href="/projects" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                View all projects
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3 className="font-bold text-foreground text-xl mb-2">Interested in the Connect App?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                We welcome conversations with funders, partners, and collaborators — for the Connect App and our broader work.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shrink-0 shadow-sm"
            >
              Get in touch
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

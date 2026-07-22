import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Users, Layers, BookOpen, Shield } from "lucide-react";
import { teamMembers } from "@/data/team";
import ProjectCard from "@/components/public/ProjectCard";
import ProofItemCard from "@/components/public/ProofItemCard";
import { usePublicProjects } from "@/hooks/usePublicProjects";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProjectToCard, publicProofToCard } from "@/lib/public/publicDataService";

export default function HomePage() {
  const { data: publicProjects = [] } = usePublicProjects();
  const { data: publicProof = [] } = usePublicProofItems();
  const proofCountByProject = new Map<string, number>();
  publicProof.forEach((item) => {
    if (item.project_id) proofCountByProject.set(item.project_id, (proofCountByProject.get(item.project_id) ?? 0) + 1);
  });
  const displayedProjects = publicProjects.filter((project) => project.featured).slice(0, 3).map((project) => publicProjectToCard(project, proofCountByProject.get(project.id) ?? 0));
  const displayedProof = publicProof.slice(0, 3).map(publicProofToCard);
  const displayedStats = [
    { value: String(publicProjects.length), label: "Public projects", sub: "published portfolio records" },
    { value: String(publicProof.length), label: "Public proof items", sub: "published evidence records" },
    { value: String(publicProof.filter((item) => item.type === "workshop").length), label: "Workshop records", sub: "published evidence records" },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 border-b border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #1e40af 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-4 h-px bg-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Playa AI</p>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.05] tracking-tight">
              Technology for{" "}
              <span className="text-primary">human connection</span>{" "}
              and community flourishing
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              We build tools that help people connect more deeply, discover their purpose, and participate meaningfully in community. Public records below are limited to items intentionally published through Grant OS.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
                data-testid="hero-cta-projects"
              >
                See our work
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/proof"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
                data-testid="hero-cta-proof"
              >
                View proof
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-border bg-card" aria-label="Impact numbers">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-y md:divide-y-0 divide-border">
            {displayedStats.map((stat) => (
              <div key={stat.label} className="py-8 px-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm font-semibold text-foreground mt-1">{stat.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we build */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-4 h-px bg-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">What we build</p>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Tools grounded in community, tested in real life
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every project comes from a real need we've observed in our community. We build, test, iterate, and document — then make the work available to others.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                Icon: Users,
                title: "Human Connection",
                description: "Tools that help people connect more authentically — from guided conversations to purpose discovery.",
              },
              {
                Icon: Layers,
                title: "Community Technology",
                description: "Practical tools built for and with communities — utilities, guides, interactive experiences.",
              },
              {
                Icon: BookOpen,
                title: "Workshops & Learning",
                description: "In-person and collaborative learning events that produce real outputs, not just conversations.",
              },
            ].map(({ Icon, title, description }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="py-20 border-b border-border bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Featured projects</p>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">Active work with real proof</h2>
            </div>
            <Link
              href="/projects"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0"
            >
              All projects
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayedProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
          <div className="mt-6 sm:hidden">
            <Link href="/projects" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              All projects <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Proof highlights */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-4 gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Proof of work</p>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">Evidence-first, not claim-first</h2>
            </div>
            <Link href="/proof" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0">
              All proof items
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Published evidence records are shown with their available source context. Publication does not upgrade an unverified claim or replace primary documentation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayedProof.map((item) => (
              <ProofItemCard key={item.id} item={item} />
            ))}
          </div>
          <div className="mt-6 sm:hidden">
            <Link href="/proof" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              All proof items <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Workshops */}
      <section className="py-20 border-b border-border bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Community activity</p>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-5">
                Workshops that produce real outputs
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We use workshops and community events to develop prototypes, guides, and methodologies. Specific outcomes should be relied on only when supported by a published evidence record.
              </p>
              <div className="mt-7">
                <Link href="/workshops" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  See all workshops
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-7">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-5">Evidence publishing rules</p>
              <ul className="space-y-4">
                {[
                  "Use primary documentation for legal, partnership, and eligibility claims",
                  "Keep unverified metrics out of funder-facing language",
                  "Distinguish prototypes, tests, plans, and completed work",
                  "Publish only records intentionally marked public",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Grant readiness */}
      <section className="py-20 border-b border-border bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-4 h-px bg-blue-400" />
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Grant readiness</p>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-5">Evidence before claims</h2>
              <p className="text-slate-300 leading-relaxed mb-7">
                Grant readiness depends on current eligibility, deadlines, and primary evidence. Unverified partnerships, legal status, user counts, and impact claims remain excluded from approved funder-facing language.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/proof"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-colors"
                >
                  View proof
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                  Get in touch
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {[
                  { label: "Primary-source evidence", value: "Required", color: "text-blue-400" },
                  { label: "Needs Confirmation claims", value: "Restricted", color: "text-amber-400" },
                  { label: "Legal and partnership claims", value: "Proof required", color: "text-amber-400" },
                ].map((row) => (
                <div key={row.label} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                  <span className="text-sm text-slate-300">{row.label}</span>
                  <span className={`text-xs font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team preview */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-4 h-px bg-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">The team</p>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">Builders, researchers, strategists</h2>
            </div>
            <Link href="/team" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0">
              Full team
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {teamMembers.filter((m) => m.type === "core").map((member, i) => {
              const bgColors = ["bg-blue-50 text-blue-700 border-blue-200", "bg-violet-50 text-violet-700 border-violet-200", "bg-emerald-50 text-emerald-700 border-emerald-200"];
              return (
                <div key={member.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center mb-4 ${bgColors[i % bgColors.length]}`}>
                    <span className="text-base font-bold">{member.name[0]}</span>
                  </div>
                  <h3 className="font-bold text-foreground">{member.name}</h3>
                  <p className="text-xs font-semibold text-primary mt-0.5 mb-3">{member.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{member.bio}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-50/60 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Interested in funding, partnering, or collaborating?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            We welcome conversations with funders, collaborators, partner organizations, and community members who share our goals.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
              data-testid="homepage-contact-cta"
            >
              Get in touch
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/projects/connect-app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              Connect App case study
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

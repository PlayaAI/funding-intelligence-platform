import { teamMembers } from "@/data/team";
import PageHeader from "@/components/public/PageHeader";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

const avatarColors = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
];

export default function TeamPage() {
  const coreMembers = teamMembers.filter((m) => m.type === "core");
  const advisors = teamMembers.filter((m) => m.type === "advisor");

  return (
    <div>
      <PageHeader
        label="Team"
        title="The people behind the work"
        subtitle="A small, focused team of builders, researchers, and strategists. We have been working together across community events, workshops, and technology projects for several years."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Core contributors */}
        <div className="mb-16">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-4 h-px bg-primary" />
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest">Core contributors</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {coreMembers.map((member, i) => (
              <div key={member.id} className="bg-card border border-border rounded-xl p-7 flex flex-col gap-5 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <div>
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center mb-5 ${avatarColors[i % avatarColors.length]}`}>
                    <span className="text-xl font-bold">{member.name[0]}</span>
                  </div>
                  <h3 className="font-bold text-foreground text-xl">{member.name}</h3>
                  <p className="text-sm font-semibold text-primary mt-1">{member.role}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{member.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border">
                  {member.expertise.map((skill) => (
                    <span key={skill} className="text-xs bg-secondary border border-border rounded-full px-2.5 py-0.5 text-muted-foreground">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Community contributors note */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-4 h-px bg-primary" />
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest">Community contributors</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 max-w-2xl">
            Playa AI's work is deeply community-embedded. Many of our projects have involved collaborators, workshop participants, and community members who have contributed ideas, testing, feedback, and their own tools.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            The Aaron Coombs Relationship Support Tool, several workshop co-facilitators, and event participants have all contributed meaningfully to the body of work. We're building a fuller record of contributors as the project matures.
          </p>
        </div>

        {/* Credibility note */}
        <div className="bg-card border border-border rounded-xl p-7 mb-14">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-4 h-px bg-primary" />
            <h3 className="text-xs font-semibold text-primary uppercase tracking-widest">A note on credibility</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 max-w-2xl">
            We aim to represent our credentials accurately. Our team has genuine experience in community building, grant research, and technical development — built through years of hands-on work rather than formal institutional roles.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            We don't claim formal partnerships or endorsements we don't have. We do claim a real track record of community activity, published work, and working prototypes. The proof is documented and public.
          </p>
        </div>

        {/* Advisors and contributors */}
        {advisors.length > 0 && (
          <div className="border-t border-border pt-12">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-4 h-px bg-primary" />
              <h2 className="text-xs font-semibold text-primary uppercase tracking-widest">Advisors and contributors</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              People who have contributed meaningfully to the work or are in the process of forming advisory relationships with Playa AI.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {advisors.map((member, i) => (
                <div key={member.id} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 hover:border-primary/30 transition-all duration-200">
                  <div>
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center mb-4 ${avatarColors[(i + 2) % avatarColors.length]}`}>
                      <span className="text-sm font-bold">{member.name[0]}</span>
                    </div>
                    <h3 className="font-bold text-foreground">{member.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{member.bio}</p>
                  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
                    {member.expertise.map((skill) => (
                      <span key={skill} className="text-xs bg-secondary border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-14 pt-10 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 bg-primary/5 border border-primary/10 rounded-xl p-7">
          <div>
            <h3 className="font-bold text-foreground text-lg mb-1">Interested in contributing or collaborating?</h3>
            <p className="text-sm text-muted-foreground">We're a small team open to the right conversations.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shrink-0"
          >
            Get in touch
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

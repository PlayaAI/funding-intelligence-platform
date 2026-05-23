import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { workshops } from "@/data/workshops";
import WorkshopCard from "@/components/public/WorkshopCard";
import PageHeader from "@/components/public/PageHeader";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProofToCard } from "@/lib/public/publicDataService";
import ProofItemCard from "@/components/public/ProofItemCard";

const byTheNumbers = [
  { num: "4", label: "Workshops completed" },
  { num: "3", label: "Cities / locations" },
  { num: "8+", label: "Projects launched from workshops" },
  { num: "2", label: "Published public outputs" },
];

const lessons = [
  "In-person workshops consistently produce stronger prototypes than fully remote ones.",
  "Participants learn more when the session ends with a tangible output they can take away.",
  "Community trust is built over repeated contact — a single workshop is not enough.",
  "The best facilitation gets out of the way and creates conditions for people to build together.",
  "Documenting the process in real time, not after the fact, produces better institutional memory.",
  "Mixing technical and non-technical participants produces more grounded, usable tools.",
];

export default function WorkshopsPage() {
  const { data: publicProof = [] } = usePublicProofItems();
  const workshopProof = publicProof.filter((item) => item.type === "workshop").map(publicProofToCard);

  return (
    <div>
      <PageHeader
        label="Workshops"
        title="Community learning that produces real outputs"
        subtitle="We run workshops and community events that generate working prototypes, published guides, and documented methodologies."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Why workshops matter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-14 pb-14 border-b border-border items-start">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-4 h-px bg-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Workshops as proof</p>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Why workshops matter for funding</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our workshops are not just learning events. They are documented community activities that produce tangible outputs — guides, prototypes, methodologies, and community connections. Each workshop represents a real investment of collective effort and knowledge.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We treat workshops as a core part of our proof package. When we apply for grants, we can point to specific events, specific participants, specific outputs, and specific dates. That's the kind of evidence that builds credibility with funders.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="bg-primary/5 border-b border-border px-5 py-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">By the numbers</p>
            </div>
            <div className="divide-y divide-border">
              {byTheNumbers.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="text-2xl font-bold text-primary">{stat.num}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workshop list */}
        <div className="mb-14">
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-4 h-px bg-primary" />
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest">Workshop archive</h2>
          </div>
          {workshopProof.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {workshopProof.map((item) => <ProofItemCard key={item.id} item={item} />)}
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">No public workshop records are published in Supabase yet, so this section is showing the program overview archive.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {workshops.map((workshop) => (
                  <WorkshopCard key={workshop.id} workshop={workshop} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Lessons learned */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 mb-10">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-4 h-px bg-primary" />
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest">What we've learned about facilitation</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lessons.map((lesson) => (
              <div key={lesson} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="leading-relaxed">{lesson}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-card border border-border rounded-xl p-7">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-4 h-px bg-primary" />
            <h3 className="text-xs font-semibold text-primary uppercase tracking-widest">Future workshops</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-2xl">
            We are planning additional workshops for 2025, including Connect App facilitation training, Ikigai group discovery sessions, and community technology build sprints. If you are interested in hosting or participating, get in touch.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Collaborate on a workshop
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

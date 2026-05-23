import { useState } from "react";
import { ProofItemType, proofTypeLabels } from "@/data/proofItems";
import ProofItemCard from "@/components/public/ProofItemCard";
import PageHeader from "@/components/public/PageHeader";
import { FileText, Presentation, BarChart3, Monitor, Clock } from "lucide-react";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProofToCard } from "@/lib/public/publicDataService";

const allTypes: Array<"All" | ProofItemType> = ["All", "workshop", "app_demo", "document", "metric"];

const typeDescriptions: Record<string, { desc: string; Icon: React.FC<{ className?: string }> }> = {
  workshop: { desc: "In-person learning and build events with documented outputs.", Icon: Presentation },
  app_demo: { desc: "Working apps and interactive experiences demonstrated in community settings.", Icon: Monitor },
  document: { desc: "Published guides, protocols, methodologies, and documentation.", Icon: FileText },
  metric: { desc: "Quantitative indicators of community activity and impact.", Icon: BarChart3 },
  testimonial: { desc: "Firsthand accounts from participants and community members.", Icon: Monitor },
};

export default function ProofPage() {
  const [activeType, setActiveType] = useState<"All" | ProofItemType>("All");
  const { data: publicProof = [], isLoading, isError, error } = usePublicProofItems();
  const proofItems = publicProof.map(publicProofToCard);

  const filtered = activeType === "All" ? proofItems : proofItems.filter((p) => p.type === activeType);

  const counts: Record<string, number> = {
    All: proofItems.length,
    workshop: proofItems.filter((p) => p.type === "workshop").length,
    app_demo: proofItems.filter((p) => p.type === "app_demo").length,
    document: proofItems.filter((p) => p.type === "document").length,
    metric: proofItems.filter((p) => p.type === "metric").length,
    testimonial: proofItems.filter((p) => p.type === "testimonial").length,
  };

  return (
    <div>
      <PageHeader
        label="Proof"
        title="Evidence of real work"
        subtitle="A public record of everything we've built, run, published, and documented. Proof-first, not claim-first."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* What counts as proof */}
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">What we count as proof</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["workshop", "app_demo", "document", "metric"] as ProofItemType[]).map((type) => {
              const { desc, Icon } = typeDescriptions[type] ?? { desc: "", Icon: FileText };
              return (
                <div key={type} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1.5">{proofTypeLabels[type]}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        {isLoading && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading public proof items...
          </div>
        )}
        {isError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load public proof items: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-8" data-testid="proof-filters">
          {allTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                activeType === type
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
              data-testid={`proof-filter-${type}`}
            >
              <span>{type === "All" ? "All items" : proofTypeLabels[type]}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeType === type ? "bg-white/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {counts[type]}
              </span>
            </button>
          ))}
        </div>

        {/* Proof items grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {filtered.map((item) => (
            <ProofItemCard key={item.id} item={item} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground text-sm">
              {isLoading ? "Loading proof items..." : "No public proof items in this category yet."}
            </div>
          )}
        </div>

        {/* What's coming */}
        <div className="border-t border-border pt-12">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-4 h-px bg-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Still collecting</p>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-3">What we're still collecting</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-7 max-w-2xl">
            Some proof is already documented. Some is in progress. We're actively working to collect session counts, participant testimonials, screenshots, and additional usage metrics — particularly for the Connect App.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Connect App session count", status: "In progress" },
              { label: "Participant testimonials", status: "To be collected" },
              { label: "App screenshots", status: "To be added" },
              { label: "Community event photos", status: "To be organized" },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-dashed border-border rounded-xl p-5">
                <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
                  <Clock className="w-3 h-3 text-amber-600" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-2">{item.label}</p>
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

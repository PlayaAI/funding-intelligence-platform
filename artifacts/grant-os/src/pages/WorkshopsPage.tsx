import PageHeader from "@/components/public/PageHeader";
import ProofItemCard from "@/components/public/ProofItemCard";
import { usePublicProofItems } from "@/hooks/usePublicProofItems";
import { publicProofToCard } from "@/lib/public/publicDataService";

export default function WorkshopsPage() {
  const { data: publicProof = [], isLoading, isError } = usePublicProofItems();
  const workshopProof = publicProof.filter((item) => item.type === "workshop").map(publicProofToCard);

  return (
    <div>
      <PageHeader
        label="Workshops"
        title="Published workshop records"
        subtitle="Only workshop evidence intentionally published through Grant OS appears here. Publication does not replace primary documentation or approve unsupported metrics."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {isLoading && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading public workshop records...
          </div>
        )}
        {isError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Public workshop data is temporarily unavailable. No fallback claims are being shown.
          </div>
        )}
        {workshopProof.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {workshopProof.map((item) => <ProofItemCard key={item.id} item={item} />)}
          </div>
        ) : !isLoading && (
          <div className="rounded-xl border border-border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
            No workshop evidence records are currently published.
          </div>
        )}
      </div>
    </div>
  );
}

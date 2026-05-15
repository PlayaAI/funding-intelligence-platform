import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/hooks/useProjects";
import type { ProofItemRow } from "@/hooks/useProofItems";
import type { ProofItemDbType } from "@/types/database";

// ──────────────────────────────────────────────────────────────────────────────
// Zod schema
// ──────────────────────────────────────────────────────────────────────────────

const PROOF_TYPES: [ProofItemDbType, ...ProofItemDbType[]] = [
  "workshop",
  "app_demo",
  "document",
  "metric",
  "testimonial",
  "case_study",
  "media",
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(PROOF_TYPES, { required_error: "Type is required" }),
  project_id: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  tags: z.string().optional(), // comma-separated; split on submit
  grant_relevance: z.string().optional(),
  media_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  document_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  public_visibility: z.boolean().optional(),
});

export type ProofItemFormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

export const PROOF_TYPE_LABELS: Record<ProofItemDbType, string> = {
  workshop: "Workshop",
  app_demo: "App Demo",
  document: "Document",
  metric: "Metric",
  testimonial: "Testimonial",
  case_study: "Case Study",
  media: "Media",
};

/** Convert a tags array to a comma-separated string for the form */
function tagsToString(tags: string[]): string {
  return tags.join(", ");
}

/** Convert a comma-separated string back to a tags array */
export function parseTagsString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProofItemFormValues) => Promise<void>;
  /** When provided, form is in edit mode. */
  defaultValues?: Partial<ProofItemRow>;
  /** When provided, the project selector is pre-filled and locked. */
  lockedProjectId?: string;
  title: string;
  submitLabel: string;
  loading: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function ProofItemFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  lockedProjectId,
  title,
  submitLabel,
  loading,
}: Props) {
  const { data: projects = [] } = useProjects();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProofItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "workshop",
      project_id: lockedProjectId ?? "",
      description: "",
      date: "",
      tags: "",
      grant_relevance: "",
      media_url: "",
      document_url: "",
      public_visibility: true,
    },
  });

  // Re-populate form whenever defaultValues or open changes
  useEffect(() => {
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? "",
        type: defaultValues.type ?? "workshop",
        project_id: lockedProjectId ?? defaultValues.project_id ?? "",
        description: defaultValues.description ?? "",
        date: defaultValues.date ?? "",
        tags: tagsToString(defaultValues.tags ?? []),
        grant_relevance: defaultValues.grant_relevance ?? "",
        media_url: defaultValues.media_url ?? "",
        document_url: defaultValues.document_url ?? "",
        public_visibility: defaultValues.public_visibility ?? true,
      });
    } else {
      reset({
        title: "",
        type: "workshop",
        project_id: lockedProjectId ?? "",
        description: "",
        date: "",
        tags: "",
        grant_relevance: "",
        media_url: "",
        document_url: "",
        public_visibility: true,
      });
    }
  }, [defaultValues, open, reset, lockedProjectId]);

  const handleFormSubmit = async (values: ProofItemFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="pi-title" className="text-xs font-medium">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pi-title"
              {...register("title")}
              placeholder="Connect App Field Sessions — Burning Man 2024"
              className="h-8 text-sm"
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Type + Project selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pi-type" className="text-xs font-medium">
                Type <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <select
                    id="pi-type"
                    {...field}
                    className="w-full h-8 text-sm border border-slate-200 rounded-md px-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PROOF_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PROOF_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.type && (
                <p className="text-xs text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pi-project" className="text-xs font-medium">
                Project
              </Label>
              <Controller
                name="project_id"
                control={control}
                render={({ field }) => (
                  <select
                    id="pi-project"
                    {...field}
                    disabled={Boolean(lockedProjectId)}
                    className="w-full h-8 text-sm border border-slate-200 rounded-md px-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pi-description" className="text-xs font-medium">
              Description
            </Label>
            <Textarea
              id="pi-description"
              {...register("description")}
              placeholder="Describe the proof item — what happened, where, and with whom."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Date + Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pi-date" className="text-xs font-medium">
                Date
              </Label>
              <Input
                id="pi-date"
                {...register("date")}
                placeholder="August 2024"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pi-tags" className="text-xs font-medium">
                Tags <span className="text-slate-400 font-normal">(comma-separated)</span>
              </Label>
              <Input
                id="pi-tags"
                {...register("tags")}
                placeholder="community, field test, humane technology"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Grant relevance */}
          <div className="space-y-1.5">
            <Label htmlFor="pi-grant-relevance" className="text-xs font-medium">
              Grant relevance
            </Label>
            <Textarea
              id="pi-grant-relevance"
              {...register("grant_relevance")}
              placeholder="Why is this proof item relevant to grant applications?"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Media URL + Document URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pi-media-url" className="text-xs font-medium">
                Media URL
              </Label>
              <Input
                id="pi-media-url"
                {...register("media_url")}
                placeholder="https://…"
                className="h-8 text-sm"
              />
              {errors.media_url && (
                <p className="text-xs text-red-500">{errors.media_url.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pi-document-url" className="text-xs font-medium">
                Document URL
              </Label>
              <Input
                id="pi-document-url"
                {...register("document_url")}
                placeholder="https://…"
                className="h-8 text-sm"
              />
              {errors.document_url && (
                <p className="text-xs text-red-500">{errors.document_url.message}</p>
              )}
            </div>
          </div>

          {/* Visibility */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("public_visibility")}
                className="rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">Visible on public site</span>
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="text-xs">
              {loading ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

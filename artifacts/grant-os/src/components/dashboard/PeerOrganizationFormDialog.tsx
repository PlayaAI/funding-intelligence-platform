import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import type { PeerOrganizationRow } from "@/types/database";
import { parseKeyPeople } from "@/lib/funderMappers";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  legacy_id: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ein: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  focus_areas: z.string().optional(),
  relevance: z.string().optional(),
  similarity_score: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  known_funders: z.string().optional(),
  source_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  confidence: z.string().optional(),
  import_source: z.string().optional(),
  last_researched_at: z.string().optional(),
  contact_name: z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type PeerOrganizationFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PeerOrganizationFormValues) => Promise<void>;
  defaultValues?: Partial<PeerOrganizationRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function rowToForm(row: Partial<PeerOrganizationRow>): PeerOrganizationFormValues {
  const people = parseKeyPeople(row.key_people ?? null);
  const primary = people.find((p) => p.role === "primary") ?? people[0];
  return {
    name: row.name ?? "",
    legacy_id: row.legacy_id ?? "",
    website: row.website ?? "",
    ein: row.ein ?? "",
    location: row.location ?? "",
    description: row.description ?? "",
    focus_areas: (row.focus_areas ?? []).join(", "),
    relevance: row.relevance_to_playa ?? row.relevance ?? "",
    similarity_score: row.similarity_score ?? "",
    known_funders: (row.known_funders ?? []).join(", "),
    source_url: row.source_url ?? "",
    confidence: row.confidence ?? "",
    import_source: row.import_source ?? "",
    last_researched_at: row.last_researched_at ? row.last_researched_at.slice(0, 10) : "",
    contact_name: primary?.name ?? "",
    contact_title: primary?.title ?? "",
    contact_email: primary?.email ?? "",
    notes: row.notes ?? "",
  };
}

export default function PeerOrganizationFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  title,
  submitLabel,
  loading,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PeerOrganizationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: rowToForm({}),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultValues ? rowToForm(defaultValues) : rowToForm({}));
  }, [open, defaultValues, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
            onOpenChange(false);
          })}
          className="space-y-3 py-2"
        >
          <FormField label="Name *" error={errors.name?.message}>
            <Input {...register("name")} className="h-8 text-sm" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Legacy ID">
              <Input {...register("legacy_id")} placeholder="po6" className="h-8 text-sm" />
            </FormField>
            <FormField label="Location">
              <Input {...register("location")} className="h-8 text-sm" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Website">
              <Input {...register("website")} className="h-8 text-sm" />
            </FormField>
            <FormField label="EIN">
              <Input {...register("ein")} className="h-8 text-sm" />
            </FormField>
          </div>

          <FormField label="Description">
            <Textarea {...register("description")} rows={2} className="text-sm" />
          </FormField>

          <FormField label="Focus areas (comma-separated)">
            <Input {...register("focus_areas")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Relevance to Playa AI">
            <Textarea {...register("relevance")} rows={2} className="text-sm" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Similarity score" error={errors.similarity_score?.message}>
              <Input type="number" min={0} max={100} {...register("similarity_score")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Confidence/source label">
              <Input {...register("confidence")} placeholder="manual, verified, imported" className="h-8 text-sm" />
            </FormField>
          </div>

          <FormField label="Known funders (comma-separated)">
            <Input {...register("known_funders")} className="h-8 text-sm" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Source URL" error={errors.source_url?.message}>
              <Input {...register("source_url")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Last researched">
              <Input type="date" {...register("last_researched_at")} className="h-8 text-sm" />
            </FormField>
          </div>

          <FormField label="Import/source">
            <Input {...register("import_source")} placeholder="manual research" className="h-8 text-sm" />
          </FormField>

          <FormField label="Primary contact">
            <Input {...register("contact_name")} placeholder="Name" className="h-8 text-sm mb-1" />
            <Input {...register("contact_title")} placeholder="Title" className="h-8 text-sm mb-1" />
            <Input {...register("contact_email")} placeholder="Email" className="h-8 text-sm" />
          </FormField>

          <FormField label="Notes">
            <Textarea {...register("notes")} rows={2} className="text-sm" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

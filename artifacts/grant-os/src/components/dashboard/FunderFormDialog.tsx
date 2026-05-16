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
import type { FunderRow } from "@/types/database";
import { parseKeyPeople } from "@/lib/funderMappers";

const REL_STATUSES = [
  "None",
  "Researching",
  "Contacted",
  "In Conversation",
  "Active Relationship",
] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  legacy_id: z.string().optional(),
  website: z.string().optional(),
  ein: z.string().optional(),
  location: z.string().optional(),
  median_grant_amount: z.coerce.number().min(0).optional(),
  giving_areas: z.string().optional(),
  open_applications: z.boolean().optional(),
  relationship_status: z.enum(REL_STATUSES),
  past_grantees: z.string().optional(),
  contact_name: z.string().optional(),
  contact_title: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type FunderFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FunderFormValues) => Promise<void>;
  defaultValues?: Partial<FunderRow>;
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

function rowToForm(row: Partial<FunderRow>): FunderFormValues {
  const people = parseKeyPeople(row.key_people ?? null);
  const primary = people.find((p) => p.role === "primary") ?? people[0];
  return {
    name: row.name ?? "",
    legacy_id: row.legacy_id ?? "",
    website: row.website ?? "",
    ein: row.ein ?? "",
    location: row.location ?? "",
    median_grant_amount: row.median_grant_amount ?? 0,
    giving_areas: (row.giving_areas ?? []).join(", "),
    open_applications: row.open_applications ?? false,
    relationship_status:
      (row.relationship_status as FunderFormValues["relationship_status"]) ?? "None",
    past_grantees: (row.past_grantees ?? []).join(", "),
    contact_name: primary?.name ?? "",
    contact_title: primary?.title ?? "",
    contact_email: primary?.email ?? "",
    notes: row.notes ?? "",
  };
}

export default function FunderFormDialog({
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
  } = useForm<FunderFormValues>({
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
              <Input {...register("legacy_id")} placeholder="f10" className="h-8 text-sm" />
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Median grant ($)">
              <Input type="number" {...register("median_grant_amount")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Relationship">
              <select
                {...register("relationship_status")}
                className="w-full h-8 text-sm border border-slate-200 rounded-lg px-2"
              >
                {REL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Giving areas (comma-separated)">
            <Input {...register("giving_areas")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Past grantees (comma-separated)">
            <Input {...register("past_grantees")} className="h-8 text-sm" />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("open_applications")} className="rounded" />
            Open applications
          </label>

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

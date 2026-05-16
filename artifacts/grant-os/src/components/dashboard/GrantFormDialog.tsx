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
import { useProjects } from "@/hooks/useProjects";
import type { GrantStatus } from "@/data/grants";
import type { GrantRow } from "@/types/database";

const STATUSES: [GrantStatus, ...GrantStatus[]] = [
  "Planned",
  "Researching",
  "Applying",
  "Submitted",
  "Awarded",
  "Declined",
  "Archived",
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  funder_name: z.string().min(1, "Funder name is required"),
  funder_id: z.string().optional(),
  status: z.enum(STATUSES),
  deadline: z.string().optional(),
  amount_min: z.coerce.number().min(0).optional(),
  amount_max: z.coerce.number().min(0).optional(),
  focus_areas: z.string().optional(),
  geography: z.string().optional(),
  eligibility: z.string().optional(),
  application_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  notes: z.string().optional(),
  related_project_id: z.string().optional(),
  fit_score: z.coerce.number().min(0).max(100).optional(),
  priority_score: z.coerce.number().min(0).max(100).optional(),
  difficulty_score: z.coerce.number().min(0).max(100).optional(),
  is_top_three: z.boolean().optional(),
});

export type GrantFormValues = z.infer<typeof schema>;

export function parseFocusAreasString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function focusAreasToString(areas: string[]): string {
  return areas.join(", ");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GrantFormValues) => Promise<void>;
  defaultValues?: Partial<GrantRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function GrantFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  title,
  submitLabel,
  loading,
}: Props) {
  const { data: projects = [] } = useProjects();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GrantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      funder_name: "",
      funder_id: "",
      status: "Researching",
      deadline: "",
      amount_min: 0,
      amount_max: 0,
      focus_areas: "",
      geography: "",
      eligibility: "",
      application_url: "",
      notes: "",
      related_project_id: "",
      fit_score: 50,
      priority_score: 50,
      difficulty_score: 50,
      is_top_three: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? "",
        funder_name: defaultValues.funder_name ?? "",
        funder_id: defaultValues.funder_id ?? "",
        status: (defaultValues.status as GrantStatus) ?? "Researching",
        deadline: defaultValues.deadline ?? "",
        amount_min: defaultValues.amount_min ?? 0,
        amount_max: defaultValues.amount_max ?? 0,
        focus_areas: focusAreasToString(defaultValues.focus_areas ?? []),
        geography: defaultValues.geography ?? "",
        eligibility: defaultValues.eligibility ?? "",
        application_url: defaultValues.application_url ?? "",
        notes: defaultValues.notes ?? "",
        related_project_id: defaultValues.related_project_id ?? "",
        fit_score: defaultValues.fit_score ?? 50,
        priority_score: defaultValues.priority_score ?? 50,
        difficulty_score: defaultValues.difficulty_score ?? 50,
        is_top_three: defaultValues.is_top_three ?? false,
      });
    } else {
      reset({
        title: "",
        funder_name: "",
        funder_id: "",
        status: "Researching",
        deadline: "",
        amount_min: 0,
        amount_max: 0,
        focus_areas: "",
        geography: "",
        eligibility: "",
        application_url: "",
        notes: "",
        related_project_id: "",
        fit_score: 50,
        priority_score: 50,
        difficulty_score: 50,
        is_top_three: false,
      });
    }
  }, [defaultValues, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          className="space-y-4 py-2"
        >
          <FormField label="Title" required error={errors.title?.message}>
            <Input {...register("title")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Funder name" required error={errors.funder_name?.message}>
            <Input {...register("funder_name")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Funder ID (optional)" error={errors.funder_id?.message}>
            <Input {...register("funder_id")} placeholder="e.g. f1" className="h-8 text-sm" />
          </FormField>

          <FormField label="Status" error={errors.status?.message}>
            <select
              {...register("status")}
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Deadline" error={errors.deadline?.message}>
            <Input type="date" {...register("deadline")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Related project" error={errors.related_project_id?.message}>
            <select
              {...register("related_project_id")}
              className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Amount min / max (USD)" error={errors.amount_min?.message}>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" {...register("amount_min")} className="h-8 text-sm" />
                  <Input type="number" {...register("amount_max")} className="h-8 text-sm" />
                </div>
          </FormField>

          <FormField label="Focus areas (comma-separated)" error={errors.focus_areas?.message}>
            <Input {...register("focus_areas")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Geography" error={errors.geography?.message}>
            <Input {...register("geography")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Eligibility" error={errors.eligibility?.message}>
            <Textarea {...register("eligibility")} rows={3} className="text-sm" />
          </FormField>

          <FormField label="Application URL" error={errors.application_url?.message}>
            <Input {...register("application_url")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} rows={2} className="text-sm" />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Fit score" error={errors.fit_score?.message}>
              <Input type="number" {...register("fit_score")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Priority score" error={errors.priority_score?.message}>
              <Input type="number" {...register("priority_score")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Difficulty score" error={errors.difficulty_score?.message}>
              <Input type="number" {...register("difficulty_score")} className="h-8 text-sm" />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("is_top_three")} className="rounded" />
            Top 3 focus grant
          </label>

          <DialogFooter className="pt-2">
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

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useApplications } from "@/hooks/useApplications";
import type { TaskDbStatus, TaskDbPriority, TaskRow } from "@/types/database";

const STATUSES: TaskDbStatus[] = [
  "Not Started", "In Progress", "Waiting", "Needs Review", "Complete", "Archived",
];
const PRIORITIES: TaskDbPriority[] = ["Low", "Medium", "High", "Urgent"];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  owner_name: z.string().optional(),
  status: z.string().default("Not Started"),
  priority: z.string().default("Medium"),
  due_date: z.string().optional(),
  related_grant_id: z.string().optional(),
  related_project_id: z.string().optional(),
  related_application_id: z.string().optional(),
  notes: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof schema>;

function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  defaultValues?: Partial<TaskRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
  lockedGrantId?: string;
  lockedProjectId?: string;
  lockedApplicationId?: string;
}

export default function TaskFormDialog({
  open, onOpenChange, onSubmit, defaultValues,
  title, submitLabel, loading,
  lockedGrantId, lockedProjectId, lockedApplicationId,
}: Props) {
  const { data: grants = [] } = useGrants();
  const { data: projects = [] } = useProjects();
  const { data: applications = [] } = useApplications();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", description: "", owner_name: "", status: "Not Started", priority: "Medium",
      due_date: "", related_grant_id: "", related_project_id: "", related_application_id: "", notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? "",
        description: defaultValues.description ?? "",
        owner_name: defaultValues.owner_name ?? "",
        status: defaultValues.status ?? "Not Started",
        priority: defaultValues.priority ?? "Medium",
        due_date: defaultValues.due_date ?? "",
        related_grant_id: defaultValues.related_grant_id ?? lockedGrantId ?? "",
        related_project_id: defaultValues.related_project_id ?? lockedProjectId ?? "",
        related_application_id: defaultValues.related_application_id ?? lockedApplicationId ?? "",
        notes: defaultValues.notes ?? "",
      });
    } else {
      reset({
        title: "", description: "", owner_name: "", status: "Not Started", priority: "Medium",
        due_date: "", related_grant_id: lockedGrantId ?? "", related_project_id: lockedProjectId ?? "",
        related_application_id: lockedApplicationId ?? "", notes: "",
      });
    }
  }, [defaultValues, open, reset, lockedGrantId, lockedProjectId, lockedApplicationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-4 py-2">
          <FormField label="Title" required error={errors.title?.message}>
            <Input {...register("title")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} rows={2} className="text-sm" />
          </FormField>

          <FormField label="Owner" error={errors.owner_name?.message}>
            <Input {...register("owner_name")} className="h-8 text-sm" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Status" error={errors.status?.message}>
              <select {...register("status")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Priority" error={errors.priority?.message}>
              <select {...register("priority")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Due date" error={errors.due_date?.message}>
            <Input type="date" {...register("due_date")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Related grant" error={errors.related_grant_id?.message}>
            <select {...register("related_grant_id")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8" disabled={!!lockedGrantId}>
              <option value="">None</option>
              {grants.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </FormField>

          <FormField label="Related project" error={errors.related_project_id?.message}>
            <select {...register("related_project_id")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8" disabled={!!lockedProjectId}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          <FormField label="Related application" error={errors.related_application_id?.message}>
            <select {...register("related_application_id")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8" disabled={!!lockedApplicationId}>
              <option value="">None</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </FormField>

          <FormField label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} rows={2} className="text-sm" />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

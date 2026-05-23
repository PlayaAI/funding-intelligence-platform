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
import type { ApplicationDbStatus } from "@/types/database";
import type { ApplicationRow } from "@/types/database";

const STATUSES: ApplicationDbStatus[] = [
  "Not Started", "Drafting", "Internal Review", "Ready to Submit",
  "Submitted", "Awarded", "Declined", "Archived",
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.string().default("Drafting"),
  owner_name: z.string().optional(),
  grant_id: z.string().optional(),
  project_id: z.string().optional(),
  google_doc_url: z.string().optional(),
  drive_folder_url: z.string().optional(),
  portal_url: z.string().optional(),
  notes: z.string().optional(),
});

export type ApplicationFormValues = z.infer<typeof schema>;

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
  onSubmit: (values: ApplicationFormValues) => Promise<void>;
  defaultValues?: Partial<ApplicationRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
  lockedGrantId?: string;
  lockedProjectId?: string;
  initialValues?: Partial<ApplicationFormValues>;
}

export default function ApplicationFormDialog({
  open, onOpenChange, onSubmit, defaultValues,
  title, submitLabel, loading,
  lockedGrantId, lockedProjectId, initialValues,
}: Props) {
  const { data: grants = [] } = useGrants();
  const { data: projects = [] } = useProjects();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApplicationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", status: "Drafting", owner_name: "", grant_id: "",
      project_id: "", google_doc_url: "", drive_folder_url: "", portal_url: "", notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? "",
        status: defaultValues.status ?? "Drafting",
        owner_name: defaultValues.owner_name ?? "",
        grant_id: defaultValues.grant_id ?? lockedGrantId ?? "",
        project_id: defaultValues.project_id ?? lockedProjectId ?? "",
        google_doc_url: defaultValues.google_doc_url ?? "",
        drive_folder_url: defaultValues.drive_folder_url ?? "",
        portal_url: defaultValues.portal_url ?? "",
        notes: defaultValues.notes ?? "",
      });
    } else {
      reset({
        title: initialValues?.title ?? "",
        status: initialValues?.status ?? "Drafting",
        owner_name: initialValues?.owner_name ?? "",
        grant_id: lockedGrantId ?? initialValues?.grant_id ?? "",
        project_id: lockedProjectId ?? initialValues?.project_id ?? "",
        google_doc_url: initialValues?.google_doc_url ?? "",
        drive_folder_url: initialValues?.drive_folder_url ?? "",
        portal_url: initialValues?.portal_url ?? "",
        notes: initialValues?.notes ?? "",
      });
    }
  }, [defaultValues, open, reset, lockedGrantId, lockedProjectId, initialValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (values) => { await onSubmit(values); })} className="space-y-4 py-2">
          <FormField label="Title" required error={errors.title?.message}>
            <Input {...register("title")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Status" error={errors.status?.message}>
            <select {...register("status")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          <FormField label="Owner" error={errors.owner_name?.message}>
            <Input {...register("owner_name")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Related grant" error={errors.grant_id?.message}>
            <select {...register("grant_id")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8" disabled={!!lockedGrantId}>
              <option value="">None</option>
              {grants.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </FormField>

          <FormField label="Related project" error={errors.project_id?.message}>
            <select {...register("project_id")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8" disabled={!!lockedProjectId}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          <FormField label="Google Doc URL" error={errors.google_doc_url?.message}>
            <Input {...register("google_doc_url")} placeholder="https://docs.google.com/..." className="h-8 text-sm" />
          </FormField>

          <FormField label="Drive Folder URL" error={errors.drive_folder_url?.message}>
            <Input {...register("drive_folder_url")} placeholder="https://drive.google.com/..." className="h-8 text-sm" />
          </FormField>

          <FormField label="Portal URL" error={errors.portal_url?.message}>
            <Input {...register("portal_url")} className="h-8 text-sm" />
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

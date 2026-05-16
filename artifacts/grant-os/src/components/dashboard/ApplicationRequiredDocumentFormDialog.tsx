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
import type { ApplicationRequiredDocumentDbStatus, ApplicationRequiredDocumentRow } from "@/types/database";

const DOC_STATUSES: ApplicationRequiredDocumentDbStatus[] = ["Needed", "In Progress", "Complete", "Not Applicable"];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().default("Needed"),
  url: z.string().optional(),
  sort_order: z.coerce.number().min(0).default(0),
});

export type ApplicationRequiredDocumentFormValues = z.infer<typeof schema>;

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
  onSubmit: (values: ApplicationRequiredDocumentFormValues) => Promise<void>;
  defaultValues?: Partial<ApplicationRequiredDocumentRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

export default function ApplicationRequiredDocumentFormDialog({
  open, onOpenChange, onSubmit, defaultValues, title, submitLabel, loading,
}: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApplicationRequiredDocumentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", status: "Needed", url: "", sort_order: 0 },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? "",
        description: defaultValues.description ?? "",
        status: defaultValues.status ?? "Needed",
        url: defaultValues.url ?? "",
        sort_order: defaultValues.sort_order ?? 0,
      });
    } else {
      reset({ title: "", description: "", status: "Needed", url: "", sort_order: 0 });
    }
  }, [defaultValues, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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

          <FormField label="Status" error={errors.status?.message}>
            <select {...register("status")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8">
              {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          <FormField label="URL" error={errors.url?.message}>
            <Input {...register("url")} placeholder="https://..." className="h-8 text-sm" />
          </FormField>

          <FormField label="Sort order" error={errors.sort_order?.message}>
            <Input type="number" {...register("sort_order")} className="h-8 text-sm" />
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

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
import type { ApplicationQuestionDbStatus, ApplicationQuestionRow } from "@/types/database";

const Q_STATUSES: ApplicationQuestionDbStatus[] = ["Draft", "Needs Review", "Approved", "Final"];

const schema = z.object({
  question: z.string().min(1, "Question is required"),
  word_limit: z.coerce.number().min(0).optional(),
  draft_answer: z.string().optional(),
  final_answer: z.string().optional(),
  owner_name: z.string().optional(),
  status: z.string().default("Draft"),
  sort_order: z.coerce.number().min(0).default(0),
});

export type ApplicationQuestionFormValues = z.infer<typeof schema>;

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
  onSubmit: (values: ApplicationQuestionFormValues) => Promise<void>;
  defaultValues?: Partial<ApplicationQuestionRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

export default function ApplicationQuestionFormDialog({
  open, onOpenChange, onSubmit, defaultValues, title, submitLabel, loading,
}: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApplicationQuestionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { question: "", word_limit: undefined, draft_answer: "", final_answer: "", owner_name: "", status: "Draft", sort_order: 0 },
  });

  useEffect(() => {
    if (!open) return;
    if (defaultValues) {
      reset({
        question: defaultValues.question ?? "",
        word_limit: defaultValues.word_limit ?? undefined,
        draft_answer: defaultValues.draft_answer ?? "",
        final_answer: defaultValues.final_answer ?? "",
        owner_name: defaultValues.owner_name ?? "",
        status: defaultValues.status ?? "Draft",
        sort_order: defaultValues.sort_order ?? 0,
      });
    } else {
      reset({ question: "", word_limit: undefined, draft_answer: "", final_answer: "", owner_name: "", status: "Draft", sort_order: 0 });
    }
  }, [defaultValues, open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (v) => { await onSubmit(v); })} className="space-y-4 py-2">
          <FormField label="Question" required error={errors.question?.message}>
            <Textarea {...register("question")} rows={3} className="text-sm" />
          </FormField>

          <FormField label="Draft answer" error={errors.draft_answer?.message}>
            <Textarea {...register("draft_answer")} rows={6} className="text-sm" placeholder="Manual draft text only — no AI generation is used here." />
          </FormField>

          <FormField label="Final answer" error={errors.final_answer?.message}>
            <Textarea {...register("final_answer")} rows={6} className="text-sm" placeholder="Approved/submission-ready answer, if available." />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Word limit" error={errors.word_limit?.message}>
              <Input type="number" {...register("word_limit")} className="h-8 text-sm" />
            </FormField>
            <FormField label="Sort order" error={errors.sort_order?.message}>
              <Input type="number" {...register("sort_order")} className="h-8 text-sm" />
            </FormField>
          </div>

          <FormField label="Owner" error={errors.owner_name?.message}>
            <Input {...register("owner_name")} className="h-8 text-sm" />
          </FormField>

          <FormField label="Status" error={errors.status?.message}>
            <select {...register("status")} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white h-8">
              {Q_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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

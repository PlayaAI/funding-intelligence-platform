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
import type { PeerFundingRecordRow } from "@/types/database";
import { useFunders } from "@/hooks/useFunders";

const schema = z.object({
  funder_name: z.string().min(1, "Funder name is required"),
  funder_id: z.string().optional(),
  award_year: z.coerce.number().min(1900).max(2100).optional().or(z.literal("")),
  amount_exact: z.coerce.number().min(0).optional().or(z.literal("")),
  amount_min: z.coerce.number().min(0).optional().or(z.literal("")),
  amount_max: z.coerce.number().min(0).optional().or(z.literal("")),
  purpose: z.string().optional(),
  program_area: z.string().optional(),
  source_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  confidence: z.string().optional(),
  notes: z.string().optional(),
});

export type PeerFundingRecordFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PeerFundingRecordFormValues) => Promise<void>;
  defaultValues?: Partial<PeerFundingRecordRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

function rowToForm(row: Partial<PeerFundingRecordRow>): PeerFundingRecordFormValues {
  return {
    funder_name: row.funder_name ?? "",
    funder_id: row.funder_id ?? "",
    award_year: row.award_year ?? row.year ?? "",
    amount_exact: row.amount_exact ?? row.amount ?? "",
    amount_min: row.amount_min ?? "",
    amount_max: row.amount_max ?? "",
    purpose: row.purpose ?? "",
    program_area: row.program_area ?? "",
    source_url: row.source_url ?? "",
    confidence: row.confidence ?? "manual",
    notes: row.notes ?? "",
  };
}

export default function PeerFundingRecordFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  title,
  submitLabel,
  loading,
}: Props) {
  const { data: funders = [] } = useFunders();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PeerFundingRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: rowToForm({}),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultValues ? rowToForm(defaultValues) : rowToForm({}));
  }, [open, defaultValues, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Funder name *</Label>
            <Input {...register("funder_name")} className="h-8 text-sm" />
            {errors.funder_name && (
              <p className="text-xs text-red-500">{errors.funder_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Linked funder (optional)</Label>
            <select {...register("funder_id")} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm">
              <option value="">None</option>
              {funders.map((funder) => <option key={funder.id} value={funder.id}>{funder.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Award year</Label>
              <Input type="number" {...register("award_year")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Exact amount ($)</Label>
              <Input type="number" {...register("amount_exact")} className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount min ($)</Label>
              <Input type="number" {...register("amount_min")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount max ($)</Label>
              <Input type="number" {...register("amount_max")} className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Purpose</Label>
            <Textarea {...register("purpose")} rows={2} className="text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Program area</Label>
              <Input {...register("program_area")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confidence/source</Label>
              <Input {...register("confidence")} className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Source URL</Label>
            <Input {...register("source_url")} className="h-8 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea {...register("notes")} rows={2} className="text-sm" />
          </div>

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

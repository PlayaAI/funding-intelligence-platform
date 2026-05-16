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

const schema = z.object({
  funder_name: z.string().min(1, "Funder name is required"),
  year: z.coerce.number().min(1900).max(2100),
  amount: z.coerce.number().min(0),
  source_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
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
    year: row.year ?? new Date().getFullYear(),
    amount: Number(row.amount ?? 0),
    source_url: row.source_url ?? "",
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Year *</Label>
              <Input type="number" {...register("year")} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount ($) *</Label>
              <Input type="number" {...register("amount")} className="h-8 text-sm" />
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

import { useEffect, useState } from "react";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  useArchiveCustomField,
  useCreateCustomField,
  useCustomFields,
  useDeleteCustomField,
  useUpdateCustomField,
  type CustomFieldRow,
} from "@/hooks/useCustomFields";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import type { CustomFieldAppliesTo, CustomFieldType, Json } from "@/types/database";

const FIELD_TYPES: Array<{ value: CustomFieldType; label: string }> = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "amount", label: "Amount" },
  { value: "date", label: "Date" },
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
];

const APPLIES_TO: Array<{ value: CustomFieldAppliesTo; label: string }> = [
  { value: "opportunities", label: "Opportunities" },
  { value: "funders", label: "Funders" },
  { value: "projects", label: "Projects" },
  { value: "applications", label: "Applications" },
];

function labelFor<T extends string>(items: Array<{ value: T; label: string }>, value: T) {
  return items.find((item) => item.value === value)?.label ?? value;
}

function parseOptions(value: string): Json | null {
  const options = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return options.length > 0 ? options : null;
}

function optionsToText(options: Json | null): string {
  return Array.isArray(options) ? options.map(String).join("\n") : "";
}

function FieldDialog({
  open,
  onOpenChange,
  field,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldRow | null;
  loading: boolean;
  onSubmit: (values: { name: string; field_type: CustomFieldType; applies_to: CustomFieldAppliesTo; options: Json | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("short_text");
  const [appliesTo, setAppliesTo] = useState<CustomFieldAppliesTo>("opportunities");
  const [options, setOptions] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(field?.name ?? "");
    setFieldType(field?.field_type ?? "short_text");
    setAppliesTo(field?.applies_to ?? "opportunities");
    setOptions(optionsToText(field?.options ?? null));
  }, [field, open]);

  const needsOptions = fieldType === "single_select" || fieldType === "multi_select";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      field_type: fieldType,
      applies_to: appliesTo,
      options: needsOptions ? parseOptions(options) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{field ? "Edit custom field" : "Add custom field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="field-name" className="text-xs">Field name</Label>
            <Input id="field-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={fieldType} onValueChange={(value) => setFieldType(value as CustomFieldType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Appears on</Label>
              <Select value={appliesTo} onValueChange={(value) => setAppliesTo(value as CustomFieldAppliesTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLIES_TO.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {needsOptions && (
            <div className="space-y-1.5">
              <Label htmlFor="field-options" className="text-xs">Options</Label>
              <Textarea id="field-options" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="One option per line" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
              {field ? "Save changes" : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardCustomFieldsPage() {
  const { user } = useAuth();
  const { canWriteTable, canDeleteRecords } = usePermissions();
  const fieldsQuery = useCustomFields();
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const archiveField = useArchiveCustomField();
  const deleteField = useDeleteCustomField();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldRow | null>(null);

  const canManage = canWriteTable("custom_fields");

  function openCreate() {
    setEditingField(null);
    setDialogOpen(true);
  }

  function openEdit(field: CustomFieldRow) {
    setEditingField(field);
    setDialogOpen(true);
  }

  async function handleSubmit(values: { name: string; field_type: CustomFieldType; applies_to: CustomFieldAppliesTo; options: Json | null }) {
    if (editingField) {
      await updateField.mutateAsync({ id: editingField.id, updates: values });
      toast({ title: "Custom field updated", description: values.name });
    } else {
      await createField.mutateAsync({ ...values, created_by: user?.id ?? null, archived_at: null });
      toast({ title: "Custom field added", description: values.name });
    }
    setDialogOpen(false);
  }

  async function handleArchive(field: CustomFieldRow) {
    await archiveField.mutateAsync(field.id);
    toast({ title: "Custom field archived", description: field.name });
  }

  async function handleDelete(field: CustomFieldRow) {
    await deleteField.mutateAsync(field.id);
    toast({ title: "Custom field deleted", description: field.name });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Custom Fields</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define workspace metadata fields for future opportunity, funder, project, and application forms.</p>
        </div>
        <Button size="sm" className="gap-2 text-xs" onClick={openCreate} disabled={!canManage}>
          <Plus size={14} />
          Add field
        </Button>
      </div>

      {!canManage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Only Admin and Grant Lead users can manage custom fields.</div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Field definitions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Appears on</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fieldsQuery.data ?? []).map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium text-slate-900">{field.name}</TableCell>
                  <TableCell><Badge variant="secondary">{labelFor(FIELD_TYPES, field.field_type)}</Badge></TableCell>
                  <TableCell className="text-slate-600">{labelFor(APPLIES_TO, field.applies_to)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canManage} onClick={() => openEdit(field)}>
                        <Edit size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canManage} onClick={() => void handleArchive(field)}>
                        <Trash2 size={14} />
                      </Button>
                      {canDeleteRecords && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600" onClick={() => void handleDelete(field)}>Delete</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {fieldsQuery.isLoading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">Loading custom fields...</TableCell></TableRow>}
              {!fieldsQuery.isLoading && (fieldsQuery.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">No custom fields yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editingField}
        loading={createField.isPending || updateField.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateKnowledgeItem, useUpdateKnowledgeItem } from "@/hooks/useAgentKnowledge";
import type { AgentKnowledgeItem } from "@/lib/agentKnowledgeService";
import { useToast } from "@/hooks/use-toast";

interface AgentKnowledgeItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemToEdit?: AgentKnowledgeItem | null;
}

export function AgentKnowledgeItemFormDialog({ open, onOpenChange, itemToEdit }: AgentKnowledgeItemFormDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateKnowledgeItem();
  const updateMutation = useUpdateKnowledgeItem();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [knowledgeType, setKnowledgeType] = useState("custom_instruction");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [confidenceStatus, setConfidenceStatus] = useState<"approved" | "needs_confirmation" | "background_only" | "do_not_use" | "outdated">("approved");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");

  useEffect(() => {
    if (open && itemToEdit) {
      setTitle(itemToEdit.title);
      setCategory(itemToEdit.category);
      setContent(itemToEdit.content);
      setKnowledgeType(itemToEdit.knowledge_type);
      setPriority(itemToEdit.priority);
      setConfidenceStatus(itemToEdit.confidence_status);
      setStatus(itemToEdit.status);
    } else if (open && !itemToEdit) {
      setTitle("");
      setCategory("");
      setContent("");
      setKnowledgeType("custom_instruction");
      setPriority("medium");
      setConfidenceStatus("approved");
      setStatus("active");
    }
  }, [open, itemToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim() || !content.trim()) {
      toast({ title: "Validation Error", description: "Title, category, and content are required.", variant: "destructive" });
      return;
    }

    const payload = {
      title,
      category,
      content,
      knowledge_type: knowledgeType,
      priority,
      confidence_status: confidenceStatus,
      status,
    };

    if (itemToEdit) {
      updateMutation.mutate({ id: itemToEdit.id, updates: payload }, {
        onSuccess: () => {
          toast({ title: "Knowledge updated", description: "The agent knowledge item was updated." });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Knowledge created", description: "The agent knowledge item was created." });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemToEdit ? "Edit Knowledge Item" : "Add Knowledge Item"}</DialogTitle>
          <DialogDescription>
            Active items are used by Hermes as its source of truth.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" placeholder="e.g., General, Safety, Budgets" value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content (Rule/Instruction) *</Label>
            <Textarea id="content" className="min-h-[100px]" value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="knowledge_type">Type</Label>
              <Select value={knowledgeType} onValueChange={setKnowledgeType}>
                <SelectTrigger id="knowledge_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved_fact">Approved Fact</SelectItem>
                  <SelectItem value="project_angle">Project Angle</SelectItem>
                  <SelectItem value="matching_rule">Matching Rule</SelectItem>
                  <SelectItem value="readiness_rule">Readiness Rule</SelectItem>
                  <SelectItem value="risky_claim">Risky Claim</SelectItem>
                  <SelectItem value="safer_language">Safer Language</SelectItem>
                  <SelectItem value="proof_requirement">Proof Requirement</SelectItem>
                  <SelectItem value="application_instruction">Application Instruction</SelectItem>
                  <SelectItem value="custom_instruction">Custom Instruction</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="do_not_use">Do Not Use</SelectItem>
                  <SelectItem value="folder_rule">Folder Rule</SelectItem>
                  <SelectItem value="daily_ops_rule">Daily Ops Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence</Label>
              <Select value={confidenceStatus} onValueChange={(val: any) => setConfidenceStatus(val)}>
                <SelectTrigger id="confidence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="needs_confirmation">Needs Confirmation</SelectItem>
                  <SelectItem value="background_only">Background Only</SelectItem>
                  <SelectItem value="do_not_use">Do Not Use</SelectItem>
                  <SelectItem value="outdated">Outdated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {itemToEdit ? "Save Changes" : "Create Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

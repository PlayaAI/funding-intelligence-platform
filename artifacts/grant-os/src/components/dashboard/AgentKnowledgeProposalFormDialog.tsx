import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposeKnowledgeUpdate } from "@/hooks/useAgentKnowledge";
import { useToast } from "@/hooks/use-toast";

interface AgentKnowledgeProposalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentKnowledgeProposalFormDialog({ open, onOpenChange }: AgentKnowledgeProposalFormDialogProps) {
  const { toast } = useToast();
  const proposeMutation = useProposeKnowledgeUpdate();

  const [title, setTitle] = useState("");
  const [proposedContent, setProposedContent] = useState("");
  const [proposalType, setProposalType] = useState<"always_rule" | "never_rule" | "do_not_use_rule" | "add">("always_rule");
  const [category, setCategory] = useState("User Instruction");
  const [rationale, setRationale] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !proposedContent.trim()) {
      toast({ title: "Validation Error", description: "Title and instruction content are required.", variant: "destructive" });
      return;
    }

    const payload = {
      title,
      proposed_content: proposedContent,
      proposal_type: proposalType,
      category,
      rationale,
      source_type: "user_instruction",
      risk_level: "medium" as const,
      status: "pending_review" as const,
    };

    proposeMutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Proposal submitted", description: "Your instruction was proposed for admin review." });
        onOpenChange(false);
        setTitle("");
        setProposedContent("");
        setRationale("");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Propose Instruction</DialogTitle>
          <DialogDescription>
            Tell Hermes what to do. Your instruction will be reviewed by an admin before becoming active.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Summary / Title *</Label>
            <Input id="title" placeholder="e.g., Always ask before mentioning Burning Man" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposed_content">Instruction Content *</Label>
            <Textarea id="proposed_content" placeholder="Hermes must never mention..." className="min-h-[80px]" value={proposedContent} onChange={(e) => setProposedContent(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="proposal_type">Rule Type</Label>
              <Select value={proposalType} onValueChange={(val: any) => setProposalType(val)}>
                <SelectTrigger id="proposal_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="always_rule">Always do this</SelectItem>
                  <SelectItem value="never_rule">Never do this</SelectItem>
                  <SelectItem value="do_not_use_rule">Mark as do-not-use</SelectItem>
                  <SelectItem value="add">Add new knowledge</SelectItem>
                  <SelectItem value="edit">Edit existing knowledge</SelectItem>
                  <SelectItem value="archive">Archive existing knowledge</SelectItem>
                  <SelectItem value="conflict_alert">Conflict alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rationale">Rationale (Optional)</Label>
            <Input id="rationale" placeholder="Why is this rule needed?" value={rationale} onChange={(e) => setRationale(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={proposeMutation.isPending}>
              Submit Proposal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

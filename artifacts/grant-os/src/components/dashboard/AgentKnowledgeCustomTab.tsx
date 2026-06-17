import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit2, Archive, Bot } from "lucide-react";
import { useKnowledgeItems, useArchiveKnowledgeItem } from "@/hooks/useAgentKnowledge";
import { usePermissions } from "@/hooks/usePermissions";
import { AgentKnowledgeItemFormDialog } from "./AgentKnowledgeItemFormDialog";
import type { AgentKnowledgeItem } from "@/lib/agentKnowledgeService";

export function AgentKnowledgeCustomTab() {
  const { data: items, isLoading } = useKnowledgeItems();
  const archiveMutation = useArchiveKnowledgeItem();
  const { isAdmin } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgentKnowledgeItem | null>(null);

  const activeItems = items?.filter(i => i.status === "active") || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Bot size={15} /> Database-Backed Rules
          </h2>
          <p className="text-xs text-slate-500">
            These rules override static instructions. Hermes checks here first.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditingItem(null); setFormOpen(true); }}>
            <PlusCircle size={14} className="mr-1.5" />
            Add Rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-500">Loading custom instructions...</div>
      ) : activeItems.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50 border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-500">No custom knowledge rules yet.</p>
            <p className="text-xs text-slate-400 mt-1">Add rules like 'Always verify fiscal sponsor language' or approve proposed updates.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {activeItems.map((item) => (
            <Card key={item.id} className="border-slate-200">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wider">{item.category}</Badge>
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">Type: {item.knowledge_type} • Priority: {item.priority}</CardDescription>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingItem(item); setFormOpen(true); }}>
                      <Edit2 size={12} className="text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-50 hover:text-red-600" onClick={() => {
                      if (confirm("Archive this rule?")) {
                        archiveMutation.mutate(item.id);
                      }
                    }}>
                      <Archive size={12} />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm bg-slate-50 p-3 rounded-md border border-slate-100 whitespace-pre-wrap">
                  {item.content}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <Badge variant="secondary" className="font-normal text-[10px]">
                    {item.confidence_status.replace(/_/g, ' ')}
                  </Badge>
                  {item.source_label && (
                    <span className="flex items-center">Source: {item.source_label}</span>
                  )}
                  <span className="flex items-center ml-auto">
                    Updated {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <AgentKnowledgeItemFormDialog 
          open={formOpen} 
          onOpenChange={setFormOpen} 
          itemToEdit={editingItem} 
        />
      )}
    </div>
  );
}

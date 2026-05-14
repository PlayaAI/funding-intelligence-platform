import { useState } from "react";
import { useRoute, Link } from "wouter";
import { applications } from "@/data/applications";
import { proofItems } from "@/data/proofItems";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tasks } from "@/data/tasks";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Save,
} from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const Q_STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  Drafting: "bg-blue-50 text-blue-700",
  "Draft Ready": "bg-amber-50 text-amber-700",
  Reviewed: "bg-green-50 text-green-700",
};
const DOC_STATUS_COLORS: Record<string, string> = {
  Missing: "bg-red-50 text-red-700 border-red-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Ready: "bg-green-50 text-green-700 border-green-200",
};

export default function DashboardApplicationDetailPage() {
  const [, params] = useRoute("/dashboard/applications/:id");
  const app = applications.find((a) => a.id === params?.id);

  const [googleDocUrl, setGoogleDocUrl] = useState(app?.googleDocUrl ?? "");
  const [driveFolderUrl, setDriveFolderUrl] = useState(app?.googleDriveFolderUrl ?? "");
  const [savedUrls, setSavedUrls] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(
    Object.fromEntries((app?.questions ?? []).map((q) => [q.id, q.draftAnswer ?? ""]))
  );
  const [finalAnswers, setFinalAnswers] = useState<Record<string, string>>(
    Object.fromEntries((app?.questions ?? []).map((q) => [q.id, q.finalAnswer ?? ""]))
  );

  if (!app) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Application not found.</p>
        <Link href="/dashboard/applications">
          <Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back</Button>
        </Link>
      </div>
    );
  }

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  const linkedProof = proofItems.filter((p) => app.linkedProofItemIds.includes(p.id));
  const relatedTasks = tasks.filter((t) => t.relatedApplicationId === app.id);
  const completedDocs = app.requiredDocs.filter((d) => d.status === "Ready").length;
  const completedQs = app.questions.filter((q) => ["Draft Ready", "Reviewed"].includes(q.status)).length;
  const isBlocked = app.requiredDocs.some((d) => d.status === "Missing");

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/applications">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
          <ArrowLeft size={14} />
          Applications
        </Button>
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{app.grantTitle}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
              <span>{app.projectName}</span>
              <span>·</span>
              <span>{app.owner}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {app.status === "Submitted" && app.submittedDate
                  ? `Submitted ${formatDate(app.submittedDate)}`
                  : `Due ${formatDate(app.deadline)}`}
              </span>
            </div>
          </div>
          <Badge className={`text-xs px-2.5 py-1 border flex-shrink-0 ${
            app.status === "Submitted" ? "bg-violet-50 text-violet-700 border-violet-200" :
            app.status === "Writing" ? "bg-blue-50 text-blue-700 border-blue-200" :
            "bg-slate-100 text-slate-700 border-slate-200"
          }`}>
            {app.status}
          </Badge>
        </div>

        {isBlocked && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
            <AlertCircle size={14} />
            <span>Missing required documents. Review the docs checklist.</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Questions done", value: `${completedQs}/${app.questions.length}` },
            { label: "Docs ready", value: `${completedDocs}/${app.requiredDocs.length}` },
            { label: "Proof items", value: linkedProof.length },
            { label: "Status", value: isBlocked ? "Blocked" : "On Track", color: isBlocked ? "text-red-500" : "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${s.color ?? "text-slate-900"}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Google Doc URL</Label>
              <div className="flex gap-2">
                <Input
                  value={googleDocUrl}
                  onChange={(e) => { setGoogleDocUrl(e.target.value); setSavedUrls(false); }}
                  placeholder="https://docs.google.com/..."
                  className="h-8 text-xs flex-1"
                />
                {googleDocUrl && (
                  <a href={googleDocUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-8 px-2">
                      <ExternalLink size={13} />
                    </Button>
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Drive Folder URL</Label>
              <div className="flex gap-2">
                <Input
                  value={driveFolderUrl}
                  onChange={(e) => { setDriveFolderUrl(e.target.value); setSavedUrls(false); }}
                  placeholder="https://drive.google.com/..."
                  className="h-8 text-xs flex-1"
                />
                {driveFolderUrl && (
                  <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-8 px-2">
                      <ExternalLink size={13} />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
          {!savedUrls && (googleDocUrl !== (app.googleDocUrl ?? "") || driveFolderUrl !== (app.googleDriveFolderUrl ?? "")) && (
            <Button size="sm" className="gap-2 text-xs h-7" onClick={() => setSavedUrls(true)}>
              <Save size={11} />
              Save links
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Draft Application Answer")}>
          <Sparkles size={12} />
          Draft Answer
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Suggest Proof Items")}>
          <Sparkles size={12} />
          Suggest Proof
        </Button>
      </div>

      <Tabs defaultValue="questions">
        <TabsList className="h-9">
          <TabsTrigger value="questions" className="text-xs">Questions ({app.questions.length})</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">Required Docs ({app.requiredDocs.length})</TabsTrigger>
          <TabsTrigger value="proof" className="text-xs">Proof Package ({linkedProof.length})</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Tasks ({relatedTasks.length})</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-4">
          {app.questions.map((q, i) => {
            const draft = draftAnswers[q.id] ?? "";
            const wc = wordCount(draft);
            const overLimit = q.wordLimit && wc > q.wordLimit;
            return (
              <Card key={q.id} className="border-slate-200">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="font-medium text-sm text-slate-800">
                      <span className="text-slate-400 mr-2">Q{i + 1}.</span>
                      {q.question}
                      {q.wordLimit && (
                        <span className="text-xs text-slate-400 ml-2 font-normal">({q.wordLimit} word limit)</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${Q_STATUS_COLORS[q.status]}`}>
                      {q.status}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Draft Answer</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-6 px-2"
                          onClick={() => handleAI("Draft Answer")}
                        >
                          <Sparkles size={11} />
                          AI Draft
                        </Button>
                      </div>
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Draft answer..."
                        className="text-sm min-h-[80px] resize-none bg-slate-50/60"
                        rows={4}
                      />
                      <div className={`text-xs mt-1 ${overLimit ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        {wc} / {q.wordLimit ?? "—"} words
                        {overLimit && " — over word limit"}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Final Answer</Label>
                        {(() => {
                          const fa = finalAnswers[q.id] ?? "";
                          const fwc = wordCount(fa);
                          const fOver = q.wordLimit && fwc > q.wordLimit;
                          return fa && (
                            <span className={`text-xs ${fOver ? "text-red-500 font-medium" : "text-slate-400"}`}>
                              {fwc} / {q.wordLimit ?? "—"} words
                              {fOver ? " — over limit" : ""}
                            </span>
                          );
                        })()}
                      </div>
                      <Textarea
                        value={finalAnswers[q.id] ?? ""}
                        onChange={(e) => setFinalAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Final approved answer (ready for submission)..."
                        className="text-sm min-h-[80px] resize-none border-green-200 bg-green-50/20 focus:border-green-400"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-400">Owner: {q.owner}</span>
                    <Button
                      size="sm"
                      className="gap-1 text-xs h-6 px-2"
                      onClick={() => {
                        if (draftAnswers[q.id]) {
                          setFinalAnswers((prev) => ({ ...prev, [q.id]: draftAnswers[q.id] }));
                          toast({ title: "Promoted to final", description: "Draft answer promoted to final answer." });
                        }
                      }}
                    >
                      Promote draft to final
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Add question", description: "Question creation coming in next phase." })
          }>
            <Plus size={12} />
            Add question
          </Button>
        </TabsContent>

        <TabsContent value="docs" className="mt-4 space-y-3">
          {app.requiredDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                {doc.status === "Ready" ? (
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                ) : doc.status === "Missing" ? (
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                ) : (
                  <Clock size={16} className="text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <div className="text-sm font-medium text-slate-800">{doc.name}</div>
                  {doc.notes && <div className="text-xs text-slate-400 mt-0.5">{doc.notes}</div>}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DOC_STATUS_COLORS[doc.status]}`}>
                {doc.status}
              </span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="proof" className="mt-4 space-y-3">
          {linkedProof.map((item) => (
            <Card key={item.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="font-medium text-sm text-slate-800">{item.title}</div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              </CardContent>
            </Card>
          ))}
          {linkedProof.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No proof items linked.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => handleAI("Suggest Proof Items")}>
            <Sparkles size={12} />
            Suggest proof items
          </Button>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {relatedTasks.map((t) => (
            <Card key={t.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-slate-800">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {t.owner} · Due {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.priority === "High" ? "destructive" : "secondary"} className="text-xs">{t.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {relatedTasks.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No tasks linked to this application.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-2" onClick={() =>
            toast({ title: "Add task", description: "Task creation coming in next phase." })
          }>
            <Plus size={12} />
            Add task
          </Button>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              {app.internalNotes ? (
                <p className="text-sm text-slate-700">{app.internalNotes}</p>
              ) : (
                <p className="text-sm text-slate-400">No internal notes.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

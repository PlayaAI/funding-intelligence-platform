import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  ListChecks,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useAgentActivity } from "@/hooks/useAgentActivity";
import {
  approvedFacts,
  briefing,
  dailyInstructions,
  initiatives,
  matchingRules,
  operatingRules,
  projectAngles,
  proofItemsNeeded,
  readinessRules,
  riskyClaims,
  type FactStatus,
  type InitiativeStatus,
  type ProofStatus,
  type RecommendationRule,
} from "@/lib/agent-knowledge/playaAiKnowledgeBase";
import { applicationManual } from "@/lib/agent-knowledge/applicationManual";
import { AgentKnowledgeCustomTab } from "@/components/dashboard/AgentKnowledgeCustomTab";
import { AgentKnowledgeProposalsTab } from "@/components/dashboard/AgentKnowledgeProposalsTab";

const factStatusLabels: Record<FactStatus, string> = {
  approved: "Approved",
  needs_confirmation: "Needs confirmation",
  background_only: "Background only",
};

const initiativeStatusLabels: Record<InitiativeStatus, string> = {
  built: "Built",
  tested: "Tested",
  planned: "Planned",
  conceptual: "Conceptual",
  needs_confirmation: "Needs confirmation",
};

const proofStatusLabels: Record<ProofStatus, string> = {
  missing: "Missing",
  needed: "Needed",
  available: "Available",
  needs_confirmation: "Needs confirmation",
};

const recommendationLabels: Record<RecommendationRule, string> = {
  apply_now: "apply_now",
  prepare_first: "prepare_first",
  monitor: "monitor",
  skip: "skip",
};

function StatusBadge({ status }: { status: FactStatus | InitiativeStatus | ProofStatus | RecommendationRule }) {
  const label =
    status in factStatusLabels
      ? factStatusLabels[status as FactStatus]
      : status in initiativeStatusLabels
        ? initiativeStatusLabels[status as InitiativeStatus]
        : status in proofStatusLabels
          ? proofStatusLabels[status as ProofStatus]
          : recommendationLabels[status as RecommendationRule];

  const className =
    status === "approved" || status === "built" || status === "tested" || status === "available" || status === "apply_now"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "needs_confirmation" || status === "prepare_first" || status === "needed"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "background_only" || status === "conceptual" || status === "planned" || status === "monitor"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-red-200 bg-red-50 text-red-700";

  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function SectionCard({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ThemePills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="text-[11px] font-medium">{item}</Badge>
      ))}
    </div>
  );
}

export default function DashboardAgentKnowledgePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpenCheck size={18} />
            Agent Knowledge Base
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Read-only source of truth for Hermes and future grant-matching agents.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">Operational AI manual</Badge>
      </div>

      <Card className="border-blue-200 bg-blue-50/70 shadow-sm">
        <CardContent className="space-y-1.5 py-4 text-sm text-blue-950">
          <div className="font-semibold">Evidence source of truth</div>
          <p>The Google Drive Grant Knowledge &amp; Evidence Library is the primary evidence repository. Grant OS is the operating index and must preserve the Claim Register status for every funder-facing claim.</p>
          <p className="text-xs text-blue-800">Needs Confirmation, Background Only, Do Not Use, and outdated items must never be presented as approved. Fiscal sponsorship through Mystic Arts Foundation is distinct from Playa AI having standalone 501(c)(3) status.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="briefing" className="space-y-4">
        <TabsList className="h-auto flex flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="briefing" className="text-xs">Briefing</TabsTrigger>
          <TabsTrigger value="angles" className="text-xs">Project Angles</TabsTrigger>
          <TabsTrigger value="matching" className="text-xs">Matching Rules</TabsTrigger>
          <TabsTrigger value="readiness" className="text-xs">Readiness</TabsTrigger>
          <TabsTrigger value="proof" className="text-xs">Proof Needed</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risky Claims</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs">Daily Instructions</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs">Application Manual</TabsTrigger>
          <TabsTrigger value="custom" className="text-xs font-semibold text-blue-700">Custom Instructions</TabsTrigger>
          <TabsTrigger value="proposals" className="text-xs font-semibold text-amber-600">Proposed Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="space-y-4">
          <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bot size={15} />Overview / Agent Briefing</CardTitle>
              <CardDescription className="text-xs">Use this language as the default funder-safe frame.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-800">{briefing.safeDescription}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Mission", briefing.mission],
                  ["Problem", briefing.problem],
                  ["Solution", briefing.solution],
                  ["Long-term vision", briefing.longTermVision],
                  ["Current stage", briefing.currentStage],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{label}</div>
                    <p className="mt-1.5 text-sm text-slate-700">{value}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-blue-100 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">What agents should know first</div>
                  <div className="mt-2"><BulletList items={briefing.agentsShouldKnowFirst} /></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <SectionCard title="Approved Facts" description="Only approved facts should appear in funder-facing output without a qualifier.">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {approvedFacts.map((fact) => (
                <div key={fact.label} className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[180px_1fr_170px]">
                  <div className="text-sm font-medium text-slate-900">{fact.label}</div>
                  <div>
                    <div className="text-sm text-slate-700">{fact.value}</div>
                    {fact.note && <div className="mt-1 text-xs text-slate-500">{fact.note}</div>}
                  </div>
                  <div className="md:text-right"><StatusBadge status={fact.status} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Products / Tools / Initiatives" description="Operational inventory for matching, readiness reports, and claim safety.">
            <div className="grid gap-3 lg:grid-cols-2">
              {initiatives.map((item) => (
                <Card key={item.name} className="border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-sm">{item.name}</CardTitle>
                      <StatusBadge status={item.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <p>{item.description}</p>
                    <InfoRow label="Grant usefulness" value={item.grantUsefulness} />
                    <InfoRow label="Evidence status" value={item.evidenceStatus} />
                    <InfoRow label="Claim safety" value={item.claimSafety} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="angles" className="grid gap-4 lg:grid-cols-2">
          {projectAngles.map((angle) => (
            <Card key={angle.code} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">{angle.code}. {angle.name}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{angle.focus}</CardDescription>
                  </div>
                  <Badge variant="outline">Angle {angle.code}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Summary" value={angle.summary} />
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Best grant themes</div>
                  <ThemePills items={angle.bestFor} />
                </div>
                <CompactList title="Recommended language" items={angle.recommendedLanguage} />
                <CompactList title="Evidence needed" items={angle.evidenceNeeded} />
                <CompactList title="Claims to avoid" items={angle.claimsToAvoid} warning />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="matching" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Strong-Fit Themes"><ThemePills items={matchingRules.strongFitThemes} /></SectionCard>
            <SectionCard title="Weak-Fit Themes"><ThemePills items={matchingRules.weakFitThemes} /></SectionCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Scoring Instructions">
              <div className="space-y-3">
                {matchingRules.scoring.map((score) => <InfoRow key={score.label} label={score.label} value={score.guidance} />)}
              </div>
            </SectionCard>
            <SectionCard title="Recommendation Rules">
              <div className="space-y-3">
                {matchingRules.recommendations.map((item) => (
                  <div key={item.rule} className="rounded-lg border border-slate-200 p-3">
                    <StatusBadge status={item.rule} />
                    <p className="mt-2 text-sm text-slate-700">{item.guidance}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="readiness" className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Required Before apply_now" description="Hermes should downgrade to prepare_first when these are missing.">
            <BulletList items={readinessRules.requiredBeforeApplyNow} />
          </SectionCard>
          <SectionCard title="Standard Application Package" description="Recommended workspace structure for active grant applications.">
            <div className="space-y-2">
              {readinessRules.standardApplicationPackage.map((folder) => (
                <div key={folder} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{folder}</div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="proof" className="space-y-4">
          <SectionCard title="Proof Items Needed" description="These should be added to Grant OS before agents make stronger recommendations.">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {proofItemsNeeded.map((item) => (
                <div key={item.name} className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 lg:grid-cols-[260px_150px_210px_1fr]">
                  <div className="text-sm font-medium text-slate-900">{item.name}</div>
                  <div><StatusBadge status={item.status} /></div>
                  <div className="text-sm text-slate-600">{item.relatedProjectAngle}</div>
                  <div className="text-sm text-slate-700">{item.whyItMatters}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card className="border-red-200 bg-red-50/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-900"><ShieldAlert size={15} />Risky Claims / Do Not Use Without Approval</CardTitle>
              <CardDescription className="text-xs text-red-700">Default to safer alternatives unless a human approves the exact claim and source.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {riskyClaims.doNotUseWithoutApproval.map((claim) => (
                  <div key={claim} className="flex gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{claim}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <SectionCard title="Preferred Safer Alternatives">
            <ThemePills items={riskyClaims.saferAlternatives} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Agent Daily Instructions" description="Hermes should produce recommendations and tasks for approval, not perform external actions.">
              <BulletList items={dailyInstructions.scan} />
            </SectionCard>
            <SectionCard title="Daily Report Format">
              <BulletList items={dailyInstructions.reportFormat} />
            </SectionCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Hermes Should">
              <BulletList items={operatingRules.should} />
            </SectionCard>
            <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FileWarning size={15} />Hermes Should Never</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-slate-800">
                  {operatingRules.never.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><ListChecks size={15} />Operating Posture</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {[
                ["Read first", "Cite source records where possible and identify missing facts."],
                ["Dry-run writes", "Use write-safe tools in dry-run mode unless Alex approves writes."],
                ["Escalate risk", "Flag unsupported claims before they enter a grant draft."],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardCheck size={14} />{label}</div>
                  <p className="mt-1 text-sm text-slate-600">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bot size={15} />{applicationManual.purpose.title}</CardTitle>
              <CardDescription className="text-xs">{applicationManual.purpose.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium text-slate-900">{applicationManual.purpose.corePrinciple}</p>
              <p className="text-sm text-slate-700">{applicationManual.purpose.note}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={applicationManual.workflow.title}>
              <div className="space-y-3">
                {applicationManual.workflow.steps.map((w, i) => (
                  <div key={w.step} className="flex gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{i + 1}</div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{w.step}</div>
                      <div className="text-xs text-slate-500">{w.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={applicationManual.decisionTree.title}>
              <div className="space-y-4">
                <CompactList title="1. Agent must ask/confirm:" items={applicationManual.decisionTree.askConfirm} />
                <CompactList title="2. Agent must run/check:" items={applicationManual.decisionTree.runCheck} />
                <CompactList title="3. Agent must produce:" items={applicationManual.decisionTree.produce} />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={applicationManual.matchAndReadinessRules.title}>
              <div className="space-y-4">
                <CompactList title="Check before drafting:" items={applicationManual.matchAndReadinessRules.checkBeforeDrafting} />
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation Rules</div>
                  <div className="space-y-2 mt-2">
                    {applicationManual.matchAndReadinessRules.recommendationRules.map(r => (
                      <div key={r.label} className="flex gap-3 items-center rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <div className="shrink-0"><StatusBadge status={r.label as RecommendationRule} /></div>
                        <div className="text-xs text-slate-600 leading-snug">{r.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={applicationManual.externalResearch.title} description={applicationManual.externalResearch.instructions}>
              <div className="space-y-4 mt-2">
                <CompactList title="NotebookLM Rules" items={applicationManual.externalResearch.notebookLMRules} />
                <CompactList title="Categorize Research Into" items={applicationManual.externalResearch.categories} />
              </div>
            </SectionCard>
          </div>

          <SectionCard title={applicationManual.folderStructure.title} description={`Root format: ${applicationManual.folderStructure.rootFormat}`}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {applicationManual.folderStructure.folders.map(f => (
                <div key={f.name} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-800 mb-2">{f.name}</div>
                  <ul className="space-y-1">
                    {f.contents.map(c => <li key={c} className="text-xs text-slate-600 flex gap-2"><div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-semibold">Important: </span>{applicationManual.folderStructure.important}
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title={applicationManual.agentOutputs.title}>
              <BulletList items={applicationManual.agentOutputs.list} />
            </SectionCard>

            <SectionCard title={applicationManual.humanTasks.title}>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {applicationManual.humanTasks.list.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ClipboardCheck size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title={applicationManual.askAlexQuestions.title}>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {applicationManual.askAlexQuestions.list.map((item) => (
                  <li key={item} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-red-200 bg-red-50/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-red-900"><ShieldAlert size={15} />{applicationManual.riskSafety.title}</CardTitle>
                <CardDescription className="text-xs text-red-700">Do not use without approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {applicationManual.riskSafety.doNotUseWithoutApproval.map((claim) => (
                    <div key={claim} className="flex gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs text-red-800">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{claim}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">Preferred safer language</div>
                  <ThemePills items={applicationManual.riskSafety.preferredSaferLanguage} />
                </div>
              </CardContent>
            </Card>

            <SectionCard title={applicationManual.toolUsage.title}>
              <div className="space-y-4">
                <CompactList title="Before Recommending" items={applicationManual.toolUsage.beforeRecommending} />
                <CompactList title="Before Saving" items={applicationManual.toolUsage.beforeSaving} />
                <CompactList title="Never Without Approval" items={applicationManual.toolUsage.neverWithoutApproval} warning />
              </div>
            </SectionCard>
          </div>

          <SectionCard title={applicationManual.outputTemplates.title}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {applicationManual.outputTemplates.templates.map(t => (
                <div key={t.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col h-full">
                  <div className="text-xs font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">{t.id}. {t.name}</div>
                  <pre className="text-[10px] text-slate-600 whitespace-pre-wrap font-mono flex-1">{t.content}</pre>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <AgentKnowledgeCustomTab />
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <AgentKnowledgeProposalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value}</div>
    </div>
  );
}

function CompactList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm text-slate-700">
            {warning ? (
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
            ) : (
              <Sparkles size={13} className="mt-0.5 flex-shrink-0 text-blue-600" />
            )}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

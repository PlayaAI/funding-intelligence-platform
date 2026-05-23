import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useFunder, useUpdateFunder, useArchiveFunder, useAllPeerFundingRecords } from "@/hooks/useFunders";
import { useGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useDocuments } from "@/hooks/useDocuments";
import { useGrantMatches } from "@/hooks/useGrantMatches";
import { useAgentReports } from "@/hooks/useAgentReports";
import { usePeerOrganizations } from "@/hooks/usePeers";
import AgentNotesPanel from "@/components/dashboard/AgentNotesPanel";
import FunderFormDialog, { type FunderFormValues } from "@/components/dashboard/FunderFormDialog";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { funderFormValuesToInsert } from "@/lib/funderFormUtils";
import { exportJson } from "@/lib/reports/reportExports";
import { DECISION_CLASSES, DECISION_LABELS, deadlineLanguage, jsonStringArray } from "@/lib/matching/matchPresentation";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import type { FunderRow, GrantMatchRow, GrantRow, Json } from "@/types/database";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Building2,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Pencil,
} from "lucide-react";

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatGrantAmount(grant: GrantRow): string {
  if (grant.amount_display) return grant.amount_display;
  if (grant.amount_min && grant.amount_max) return `${formatMoney(grant.amount_min)}-${formatMoney(grant.amount_max)}`;
  if (grant.amount_max) return `Up to ${formatMoney(grant.amount_max)}`;
  if (grant.amount_min) return formatMoney(grant.amount_min);
  return "—";
}

function cleanName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "funder";
}

function isInviteOnly(funder: FunderRow): boolean {
  return /invite|invitation only|by invitation/i.test(`${funder.openness_to_new_grantees ?? ""} ${funder.notes ?? ""}`);
}

function parseSourceMetadata(notes: string | null): Record<string, unknown> | null {
  const marker = "Instrumentl source metadata:";
  const index = notes?.indexOf(marker) ?? -1;
  if (!notes || index < 0) return null;
  const raw = notes.slice(index + marker.length).trim();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function sourceValue(metadata: Record<string, unknown> | null, key: string): string | null {
  const direct = metadata?.[key];
  if (typeof direct === "string" && direct.trim()) return direct;
  const raw = metadata?.raw_source_row;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function displayNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.split("Instrumentl source metadata:")[0].trim() || null;
}

function cleanArea(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/^\d+\s+awards?$/i.test(trimmed)) return false;
  return true;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="pt-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function bestMatchForGrant(grantId: string, matches: GrantMatchRow[]): GrantMatchRow | null {
  return matches
    .filter((match) => match.grant_id === grantId)
    .sort((a, b) => b.match_score - a.match_score)[0] ?? null;
}

export default function DashboardFunderDetailPage() {
  const [, params] = useRoute("/dashboard/funders/:id");
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const funderId = params?.id;
  const { data: funder, isLoading, isError, error } = useFunder(funderId);
  const { data: grants = [] } = useGrants();
  const { data: projects = [] } = useProjects();
  const { data: documents = [] } = useDocuments();
  const { data: matches = [] } = useGrantMatches({ status: "all" });
  const { data: agentReports = [] } = useAgentReports();
  const { data: peerFundingRecords = [] } = useAllPeerFundingRecords();
  const { data: peerOrganizations = [] } = usePeerOrganizations();
  const updateFunder = useUpdateFunder();
  const archiveFunder = useArchiveFunder();
  const { canWriteTable } = usePermissions();

  const metadata = useMemo(() => parseSourceMetadata(funder?.notes ?? null), [funder?.notes]);

  const relatedGrants = useMemo(() => {
    if (!funder) return [];
    const nameLower = funder.name.toLowerCase();
    return grants
      .filter((grant) =>
        grant.funder_id === funder.id ||
        (funder.legacy_id && grant.funder_id === funder.legacy_id) ||
        (grant.funder_name && grant.funder_name.toLowerCase() === nameLower)
      )
      .sort((a, b) => {
        const matchDiff = (bestMatchForGrant(b.id, matches)?.match_score ?? 0) - (bestMatchForGrant(a.id, matches)?.match_score ?? 0);
        if (matchDiff !== 0) return matchDiff;
        return (new Date(a.deadline ?? "9999-12-31").getTime()) - (new Date(b.deadline ?? "9999-12-31").getTime());
      });
  }, [funder, grants, matches]);

  const relatedGrantIds = useMemo(() => new Set(relatedGrants.map((grant) => grant.id)), [relatedGrants]);
  const relatedMatches = useMemo(
    () => matches.filter((match) => match.funder_id === funder?.id || relatedGrantIds.has(match.grant_id)),
    [matches, funder?.id, relatedGrantIds]
  );
  const relatedDocuments = useMemo(
    () => documents.filter((doc) => !doc.archived_at && (doc.related_funder_id === funder?.id || (doc.related_grant_id && relatedGrantIds.has(doc.related_grant_id)))),
    [documents, funder?.id, relatedGrantIds]
  );
  const relatedReports = useMemo(
    () => agentReports.filter((report) => report.related_grant_id && relatedGrantIds.has(report.related_grant_id)),
    [agentReports, relatedGrantIds]
  );
  const peerById = useMemo(() => new Map(peerOrganizations.map((peer) => [peer.id, peer])), [peerOrganizations]);
  const relatedPeerFunding = useMemo(() => {
    if (!funder) return [];
    const name = funder.name.toLowerCase();
    return peerFundingRecords.filter((record) =>
      record.funder_id === funder.id ||
      (record.funder_name ?? "").toLowerCase() === name
    );
  }, [funder, peerFundingRecords]);

  const projectMatchRows = useMemo(() => {
    const byProject = new Map<string, { projectName: string; bestScore: number; count: number; bestDecision: string }>();
    relatedMatches.forEach((match) => {
      const project = projects.find((item) => item.id === match.project_id);
      const current = byProject.get(match.project_id);
      if (!current || match.match_score > current.bestScore) {
        byProject.set(match.project_id, {
          projectName: project?.name ?? "Unknown project",
          bestScore: match.match_score,
          count: (current?.count ?? 0) + 1,
          bestDecision: DECISION_LABELS[match.decision_label],
        });
      } else if (current) {
        current.count += 1;
      }
    });
    return [...byProject.values()].sort((a, b) => b.bestScore - a.bestScore).slice(0, 10);
  }, [relatedMatches, projects]);

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" />Loading funder…</div>;
  }

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" />
          <div>
            <p className="font-semibold">Could not load funder</p>
            <p className="text-xs mt-1">{error instanceof Error ? error.message : String(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!funder) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Funder not found.</p>
        <Link href="/dashboard/funders"><Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to funders</Button></Link>
      </div>
    );
  }

  const instrumentlLink = sourceValue(metadata, "instrumentl_deep_link") ?? sourceValue(metadata, "instrumentl_funder_deep_link");
  const form990Link = sourceValue(metadata, "instrumentl_990_url");
  const notes = displayNotes(funder.notes);
  const givingAreas = (funder.giving_areas ?? []).filter(cleanArea).slice(0, 24);
  const availableGrantCount = relatedGrants.length;
  const topGrants = relatedGrants.slice(0, 25);

  async function handleEdit(values: FunderFormValues) {
    try {
      await updateFunder.mutateAsync({ id: funder!.id, updates: funderFormValuesToInsert(values) });
      toast({ title: "Funder updated", description: values.name });
      setEditOpen(false);
    } catch (err) {
      toast({ title: "Failed to update funder", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      throw err;
    }
  }

  async function handleArchive() {
    if (!funder) return;
    try {
      await archiveFunder.mutateAsync(funder.id);
      toast({ title: "Funder archived", description: funder.name });
      navigate("/dashboard/funders");
    } catch (err) {
      toast({ title: "Failed to archive funder", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  }

  function handleExport() {
    if (!funder) return;
    exportJson(`grant-os-funder-${cleanName(funder.name)}.json`, {
      generated_at: new Date().toISOString(),
      report_type: "funder_profile",
      funder,
      related_grants: relatedGrants,
      related_documents: relatedDocuments,
      related_matches: relatedMatches,
      related_agent_reports: relatedReports,
      source_metadata: metadata,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <Link href="/dashboard/funders">
            <Button variant="ghost" size="sm" className="gap-2 text-xs h-8"><ArrowLeft size={14} />Back to Funders</Button>
          </Link>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-slate-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{funder.name}</h1>
                <Badge className="bg-slate-100 text-slate-700 border-slate-200">{funder.relationship_status ?? "None"}</Badge>
                {isInviteOnly(funder) && <Badge className="bg-amber-50 text-amber-700 border-amber-200">Invite-only</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
                {funder.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{funder.location}</span>}
                {funder.ein && <span className="inline-flex items-center gap-1"><Hash size={13} />EIN {funder.ein}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {funder.website && <a href={funder.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Website</Button></a>}
          {instrumentlLink && <a href={instrumentlLink} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Instrumentl</Button></a>}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExport}><Download size={12} />Export Funder JSON</Button>
          {canWriteTable("funders") && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}><Pencil size={12} />Edit Funder</Button>}
          {canWriteTable("funders") && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setArchiveOpen(true)}><Archive size={12} />Archive</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="EIN" value={funder.ein ?? "—"} />
        <StatCard label="Location" value={funder.location ?? "—"} />
        <StatCard label="Invite-only" value={isInviteOnly(funder) ? "Yes" : "No"} />
        <StatCard label="Website" value={funder.website ? "Yes" : "Missing"} />
        <StatCard label="Median Grant" value={formatMoney(funder.median_grant_amount)} />
        <StatCard label="Total Giving" value={formatMoney(funder.annual_giving)} />
        <StatCard label="Total Assets" value={formatMoney(funder.assets)} />
        <StatCard label="Linked Grants" value={availableGrantCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">About / Description</CardTitle></CardHeader>
            <CardContent>
              {notes ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</p>
              ) : (
                <p className="text-sm text-slate-400">More funder details can be added as notes or imported from source records.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Giving / Funding Intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">Openness to new grantees</div><div className="font-medium text-slate-800 mt-0.5">{funder.openness_to_new_grantees ?? (funder.open_applications ? "Open applications" : "Unknown")}</div></div>
                <div><div className="text-xs text-slate-500">Available grant programs</div><div className="font-medium text-slate-800 mt-0.5">{availableGrantCount}</div></div>
                <div><div className="text-xs text-slate-500">Median grant amount</div><div className="font-medium text-slate-800 mt-0.5">{formatMoney(funder.median_grant_amount)}</div></div>
                <div><div className="text-xs text-slate-500">Total giving / assets</div><div className="font-medium text-slate-800 mt-0.5">{formatMoney(funder.annual_giving)} / {formatMoney(funder.assets)}</div></div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">Giving areas / focus areas</div>
                {givingAreas.length ? (
                  <div className="flex flex-wrap gap-1.5">{givingAreas.map((area) => <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>)}</div>
                ) : (
                  <p className="text-sm text-slate-400">No clean giving areas available.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {funder.website && <a href={funder.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Website</Button></a>}
                {form990Link && <a href={form990Link} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />990 link</Button></a>}
                {instrumentlLink && <a href={instrumentlLink} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><ExternalLink size={12} />Instrumentl source</Button></a>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Related Grants</CardTitle></CardHeader>
            <CardContent>
              {topGrants.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-slate-500 border-b">{["Grant", "Deadline", "Amount", "Status", "Project", "Match", ""].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {topGrants.map((grant) => {
                        const match = bestMatchForGrant(grant.id, matches);
                        const project = grant.related_project_id ? projects.find((item) => item.id === grant.related_project_id) : null;
                        const deadline = deadlineLanguage(grant.deadline ?? grant.next_deadline);
                        return (
                          <tr key={grant.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 min-w-72 font-medium text-slate-800 line-clamp-1">{grant.title}</td>
                            <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{deadline.label}</td>
                            <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{formatGrantAmount(grant)}</td>
                            <td className="py-2 pr-3"><GrantStatusBadge status={grant.status} /></td>
                            <td className="py-2 pr-3 text-slate-600">{project?.name ?? grant.related_project_slug ?? "—"}</td>
                            <td className="py-2 pr-3">{match ? <Badge className={DECISION_CLASSES[match.decision_label]}>{match.match_score} · {DECISION_LABELS[match.decision_label]}</Badge> : <span className="text-xs text-slate-400">No match</span>}</td>
                            <td className="py-2 pr-0 text-right"><Link href={`/dashboard/grants/${grant.id}`} className="text-xs text-primary font-medium">Open</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-400">No grants linked to this funder.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {relatedDocuments.slice(0, 20).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-800 line-clamp-1">{doc.title}</div>
                    <div className="text-xs text-slate-500">{doc.document_type.replace(/_/g, " ")} · {doc.extraction_status}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(doc.source_url || doc.file_url) && <a href={doc.source_url ?? doc.file_url ?? ""} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 text-xs">Source</Button></a>}
                    <Link href={`/dashboard/documents/${doc.id}`}><Button size="sm" variant="outline" className="h-7 text-xs">Open</Button></Link>
                  </div>
                </div>
              ))}
              {relatedDocuments.length === 0 && <div className="text-center py-8 text-sm text-slate-400">No documents linked to this funder yet.</div>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Peer Intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {relatedPeerFunding.slice(0, 10).map((record) => {
                const peer = peerById.get(record.peer_organization_id);
                return (
                  <div key={record.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm text-slate-800">{peer?.name ?? "Unknown peer"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{record.award_year ?? record.year ?? "Year unknown"} · {formatMoney(record.amount_exact ?? record.amount ?? record.amount_max ?? record.amount_min)}</div>
                        {record.purpose && <div className="text-xs text-slate-600 mt-1">{record.purpose}</div>}
                      </div>
                      {peer && <Link href={`/dashboard/peers/${peer.id}`}><Button size="sm" variant="outline" className="h-7 text-xs">Open Peer</Button></Link>}
                    </div>
                    {record.source_url && <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs text-primary hover:underline">Source</a>}
                  </div>
                );
              })}
              {relatedPeerFunding.length === 0 && <div className="text-center py-6 text-sm text-slate-400">No peer funding records linked to this funder yet.</div>}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Related Projects / Matches</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {projectMatchRows.map((row) => (
                <div key={row.projectName} className="rounded-lg border border-slate-100 p-3">
                  <div className="font-medium text-sm text-slate-800">{row.projectName}</div>
                  <div className="text-xs text-slate-500 mt-1">Best score {row.bestScore} · {row.bestDecision} · {row.count} matched opportunities</div>
                </div>
              ))}
              {projectMatchRows.length === 0 && <div className="text-center py-6 text-sm text-slate-400">No project match data for this funder yet.</div>}
            </CardContent>
          </Card>

          <AgentNotesPanel relatedFunderId={funder.id} title="Agent Notes" />

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Agent Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {relatedReports.slice(0, 5).map((report) => (
                <div key={report.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="font-medium text-sm text-slate-800">{report.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(report.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {relatedReports.length === 0 && <div className="text-center py-6 text-sm text-slate-400">No reports linked through this funder’s grants.</div>}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Source Links / Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><div className="text-xs text-slate-500">Website</div><div className="break-all">{funder.website ?? "—"}</div></div>
              <div><div className="text-xs text-slate-500">990 link</div><div className="break-all">{form990Link ?? "—"}</div></div>
              <div><div className="text-xs text-slate-500">Instrumentl link</div><div className="break-all">{instrumentlLink ?? "—"}</div></div>
              <div><div className="text-xs text-slate-500">Phone / Address</div><div>{[funder.phone, funder.address].filter(Boolean).join(" · ") || "—"}</div></div>
              {metadata && (
                <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">Source metadata</summary>
                  <pre className="mt-2 max-h-80 overflow-auto text-[11px] text-slate-600 whitespace-pre-wrap">{JSON.stringify(metadata, null, 2)}</pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <FunderFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={funder}
        title="Edit funder"
        submitLabel="Save changes"
        loading={updateFunder.isPending}
      />

      {archiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-md w-full shadow-lg">
            <h2 className="font-semibold text-slate-900">Archive this funder?</h2>
            <p className="text-sm text-slate-500 mt-2">This hides “{funder.name}” from active lists without deleting data.</p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setArchiveOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleArchive}>Archive</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

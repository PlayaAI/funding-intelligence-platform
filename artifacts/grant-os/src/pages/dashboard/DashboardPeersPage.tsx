import { useState } from "react";
import { Link } from "wouter";
import { peerOrgs, type PeerOrg } from "@/data/peers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Search, Network, ExternalLink, Sparkles,
  Mail, User, Hash, FileBarChart2, Bookmark, ArrowRight,
} from "lucide-react";

function fmtAmount(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardPeersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PeerOrg>(peerOrgs[0]);

  const filtered = peerOrgs.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.focusAreas.some((a) => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Peer Organizations</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 gap-1"
              onClick={() => toast({ title: "Add peer org", description: "Peer org creation form coming in next phase." })}
            >
              <Plus size={11} />
              Add
            </Button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search peers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 h-7 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((p) => {
            const totalFunding = p.fundingRecords.reduce((s, r) => s + r.amount, 0);
            const isSelected = selected.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`px-3 py-2.5 border-b border-slate-100 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="font-medium text-sm text-slate-800 line-clamp-1">{p.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.location}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-500">{p.fundingRecords.length} funding records</span>
                  <span className="text-[11px] font-medium text-slate-700">{fmtAmount(totalFunding)}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs">No peers found.</div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/40 p-5">
        {selected && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Network size={20} className="text-slate-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                    <div className="text-xs text-slate-400">{selected.location}</div>
                    {selected.ein && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Hash size={10} />
                        EIN: {selected.ein}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selected.website && (
                    <a href={selected.website} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                        <ExternalLink size={11} />
                        Website
                      </Button>
                    </a>
                  )}
                  <Link href={`/dashboard/peers/${selected.id}`}>
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-primary border-primary/30 hover:bg-primary/5">
                      Full profile
                      <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-3">{selected.description}</p>

              <div className="flex flex-wrap gap-1.5">{selected.focusAreas.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
              ))}</div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">{selected.fundingRecords.length}</div>
                  <div className="text-[11px] text-slate-400">Records</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">
                    {[...new Set(selected.fundingRecords.map((r) => r.funderName))].length}
                  </div>
                  <div className="text-[11px] text-slate-400">Funders</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-900">
                    {fmtAmount(selected.fundingRecords.reduce((s, r) => s + r.amount, 0))}
                  </div>
                  <div className="text-[11px] text-slate-400">Total found</div>
                </div>
              </div>
            </div>

            {(selected.contactName || selected.contactEmail) && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User size={13} className="text-slate-400" />
                    Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selected.contactName && (
                    <div>
                      <div className="text-xs text-slate-500">Name</div>
                      <div className="text-sm font-medium text-slate-800">{selected.contactName}</div>
                      {selected.contactTitle && <div className="text-xs text-slate-400">{selected.contactTitle}</div>}
                    </div>
                  )}
                  {selected.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${selected.contactEmail}`} className="text-xs text-primary hover:underline">
                        {selected.contactEmail}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileBarChart2 size={13} className="text-slate-400" />
                  990 / Financial Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selected.ein ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Hash size={11} />
                      EIN: <span className="font-mono font-medium text-slate-700">{selected.ein}</span>
                    </div>
                    <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100">
                      990 data will be pulled from ProPublica Nonprofit Explorer in a later phase.
                    </div>
                    <a
                      href={`https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(selected.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1">
                        <ExternalLink size={11} />
                        View on ProPublica
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">EIN not yet recorded for this organization.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Relevance to Playa AI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{selected.relevance}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Funding History</CardTitle>
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() =>
                    toast({ title: "Add funding record", description: "Funding record creation coming in next phase." })
                  }>
                    <Plus size={11} />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-1.5 text-xs font-semibold text-slate-400">Funder</th>
                      <th className="text-left py-1.5 text-xs font-semibold text-slate-400">Year</th>
                      <th className="text-right py-1.5 text-xs font-semibold text-slate-400">Amount</th>
                      <th className="text-left py-1.5 text-xs font-semibold text-slate-400 pl-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.fundingRecords.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 text-sm font-medium text-slate-700">{r.funderName}</td>
                        <td className="py-2 text-xs text-slate-500">{r.year}</td>
                        <td className="py-2 text-xs font-semibold text-slate-700 text-right">{fmtAmount(r.amount)}</td>
                        <td className="py-2 text-xs text-slate-400 pl-3">{r.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selected.fundingRecords.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-400">No funding records.</div>
                )}
              </CardContent>
            </Card>

            {selected.savedOpportunities && selected.savedOpportunities.length > 0 && (
              <Card className="border-blue-100 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                    <Bookmark size={13} className="text-blue-500" />
                    Saved Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {selected.savedOpportunities.map((opp, i) => (
                    <div key={i} className="bg-white rounded-lg border border-blue-100 p-3">
                      <div className="font-medium text-sm text-slate-800">{opp.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opp.funderName} · Deadline: {opp.deadline}</div>
                      <div className="text-xs text-blue-700 mt-1.5 bg-blue-50 px-2 py-1 rounded">{opp.relevance}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Funders Discovered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(selected.fundingRecords.map((r) => r.funderName))].map((f) => (
                    <span key={f} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                      {f}
                    </span>
                  ))}
                </div>
                <Button size="sm" className="gap-1.5 text-xs w-full mt-3" onClick={() =>
                  toast({ title: "Analyze Funding Patterns", description: "AI workflow will be connected in a later phase." })
                }>
                  <Sparkles size={12} />
                  Analyze Funding Patterns
                </Button>
              </CardContent>
            </Card>

            {selected.notes && (
              <Card className="border-amber-200 bg-amber-50/40">
                <CardContent className="pt-4">
                  <div className="text-xs font-semibold text-amber-800 mb-1">Notes</div>
                  <p className="text-sm text-amber-900">{selected.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

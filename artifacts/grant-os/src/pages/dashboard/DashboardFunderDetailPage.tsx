import { useRoute, Link } from "wouter";
import { funders } from "@/data/funders";
import { grants } from "@/data/grants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GrantStatusBadge from "@/components/dashboard/GrantStatusBadge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, ExternalLink, Sparkles, Plus, Building2,
  Mail, User, Hash, FileBarChart2,
} from "lucide-react";

function fmt(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardFunderDetailPage() {
  const [, params] = useRoute("/dashboard/funders/:id");
  const funder = funders.find((f) => f.id === params?.id);

  if (!funder) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Funder not found.</p>
        <Link href="/dashboard/funders">
          <Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to funders</Button>
        </Link>
      </div>
    );
  }

  const relatedGrants = grants.filter((g) => funder.relatedGrantIds.includes(g.id));

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/funders">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
          <ArrowLeft size={14} />
          Funder Intelligence
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Building2 size={22} className="text-slate-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{funder.name}</h1>
            <div className="text-sm text-slate-500">{funder.location}</div>
            {funder.ein && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <Hash size={10} />
                EIN: <span className="font-mono">{funder.ein}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            funder.openApplications
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
          }`}>
            {funder.openApplications ? "Open applications" : "By invitation only"}
          </span>
          <span className="text-xs text-slate-500">{funder.relationshipStatus}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Summarize Funder")}>
          <Sparkles size={12} />
          Summarize Funder
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Suggest Project Angle")}>
          <Sparkles size={12} />
          Best Project Angle
        </Button>
        {funder.website && (
          <a href={funder.website} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={12} />
              Website
            </Button>
          </a>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs">Contact & 990</TabsTrigger>
          <TabsTrigger value="grants" className="text-xs">Grants ({relatedGrants.length})</TabsTrigger>
          <TabsTrigger value="grantees" className="text-xs">Past Grantees</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {funder.totalAssets && <div><span className="text-slate-500 text-xs">Total Assets</span><div className="font-medium mt-0.5">{funder.totalAssets}</div></div>}
                {funder.annualGiving && <div><span className="text-slate-500 text-xs">Annual Giving</span><div className="font-medium mt-0.5">{funder.annualGiving}</div></div>}
                <div><span className="text-slate-500 text-xs">Median Grant</span><div className="font-medium mt-0.5">{fmt(funder.medianGrantAmount)}</div></div>
                <div><span className="text-slate-500 text-xs">Peer Connections</span><div className="font-medium mt-0.5">{funder.peerConnections} organizations</div></div>
                {funder.ein && <div><span className="text-slate-500 text-xs">EIN</span><div className="font-mono font-medium mt-0.5 text-sm">{funder.ein}</div></div>}
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Giving Areas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {funder.givingCategories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User size={13} className="text-slate-400" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funder.contactName ? (
                <>
                  <div>
                    <div className="text-xs text-slate-500">Program Officer / Contact</div>
                    <div className="font-medium text-slate-800 mt-0.5">{funder.contactName}</div>
                    {funder.contactTitle && <div className="text-xs text-slate-400">{funder.contactTitle}</div>}
                  </div>
                  {funder.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${funder.contactEmail}`} className="text-sm text-primary hover:underline">
                        {funder.contactEmail}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-400">No contact recorded yet.</div>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1" onClick={() =>
                toast({ title: "Edit contact", description: "Contact editing coming in next phase." })
              }>
                Edit Contact
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileBarChart2 size={13} className="text-slate-400" />
                990 / Financial Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funder.ein ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Hash size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 text-xs">EIN:</span>
                    <span className="font-mono font-medium text-slate-700">{funder.ein}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs text-slate-400">
                    Full 990 data will be pulled from ProPublica Nonprofit Explorer in a later phase.
                  </div>
                  <a
                    href={`https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(funder.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <ExternalLink size={11} />
                      View on ProPublica
                    </Button>
                  </a>
                </>
              ) : (
                <div className="text-sm text-slate-400">No EIN recorded. Add an EIN to unlock 990 lookups.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grants" className="mt-4 space-y-3">
          {relatedGrants.map((g) => (
            <Link href={`/dashboard/grants/${g.id}`} key={g.id}>
              <Card className="border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{g.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{new Date(g.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <GrantStatusBadge status={g.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {relatedGrants.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No grants linked to this funder.</div>
          )}
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() =>
            toast({ title: "Add grant", description: "Grant creation form coming in next phase." })
          }>
            <Plus size={12} />
            Add grant for this funder
          </Button>
        </TabsContent>

        <TabsContent value="grantees" className="mt-4">
          {funder.pastGrantees && funder.pastGrantees.length > 0 ? (
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Known Past Grantees</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {funder.pastGrantees.map((g) => (
                    <li key={g} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() => handleAI("Analyze Peer Patterns")}>
                  <Sparkles size={12} />
                  Analyze patterns
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm">No past grantees recorded. Add peer org funding records to build this view.</div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              {funder.notes ? (
                <p className="text-sm text-slate-700">{funder.notes}</p>
              ) : (
                <p className="text-sm text-slate-400">No notes yet.</p>
              )}
              <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() =>
                toast({ title: "Edit notes", description: "Note editing coming in next phase." })
              }>
                Edit Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

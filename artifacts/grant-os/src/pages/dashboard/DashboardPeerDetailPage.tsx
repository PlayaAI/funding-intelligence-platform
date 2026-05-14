import { useRoute, Link } from "wouter";
import { peerOrgs } from "@/data/peers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, ExternalLink, Network, Plus } from "lucide-react";

function fmtAmount(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardPeerDetailPage() {
  const [, params] = useRoute("/dashboard/peers/:id");
  const peer = peerOrgs.find((p) => p.id === params?.id);

  if (!peer) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Peer organization not found.</p>
        <Link href="/dashboard/peers">
          <Button variant="ghost" className="mt-4 gap-2"><ArrowLeft size={14} />Back to peers</Button>
        </Link>
      </div>
    );
  }

  const handleAI = (action: string) =>
    toast({ title: action, description: "AI workflow will be connected in a later phase." });

  const uniqueFunders = [...new Set(peer.fundingRecords.map((r) => r.funderName))];
  const totalFunding = peer.fundingRecords.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/peers">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8">
          <ArrowLeft size={14} />
          Peer Organizations
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <Network size={22} className="text-slate-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{peer.name}</h1>
            <div className="text-sm text-slate-500">{peer.location}</div>
          </div>
        </div>
        {peer.website && (
          <a href={peer.website} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={12} />
              Website
            </Button>
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleAI("Analyze Funding Patterns")}>
          <Sparkles size={12} />
          Analyze Funding Patterns
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleAI("Recommend Funders")}>
          <Sparkles size={12} />
          Recommend Funders to Pursue
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-slate-500">Funding records</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{peer.fundingRecords.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-slate-500">Unique funders</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{uniqueFunders.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-slate-500">Total found</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{fmtAmount(totalFunding)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="funding" className="text-xs">Funding History</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <p className="text-sm text-slate-700">{peer.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {peer.focusAreas.map((a) => (
                  <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Relevance to Playa AI</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{peer.relevance}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Funders Discovered</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {uniqueFunders.map((f) => (
                  <span key={f} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                    {f}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funding" className="mt-4 space-y-3">
          {peer.fundingRecords.map((r) => (
            <Card key={r.id} className="border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-slate-800">{r.funderName}</div>
                    {r.notes && <div className="text-xs text-slate-400 mt-0.5">{r.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{fmtAmount(r.amount)}</div>
                    <div className="text-xs text-slate-400">{r.year}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-2" onClick={() =>
            toast({ title: "Add funding record", description: "Funding record creation coming in next phase." })
          }>
            <Plus size={12} />
            Add funding record
          </Button>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              {peer.notes ? (
                <p className="text-sm text-slate-700">{peer.notes}</p>
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

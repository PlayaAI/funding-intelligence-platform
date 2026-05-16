import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useMappedPeer,
  useUpdatePeerOrganization,
  useArchivePeerOrganization,
  useDeletePeerOrganization,
  useCreatePeerFundingRecord,
} from "@/hooks/usePeers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PeerOrganizationFormDialog, {
  type PeerOrganizationFormValues,
} from "@/components/dashboard/PeerOrganizationFormDialog";
import PeerFundingRecordFormDialog, {
  type PeerFundingRecordFormValues,
} from "@/components/dashboard/PeerFundingRecordFormDialog";
import { peerFormValuesToInsert } from "@/lib/peerFormUtils";
import { peerFundingRecordFormValuesToInsert } from "@/lib/peerFundingRecordFormUtils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Network,
  Plus,
  Pencil,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";

function fmtAmount(n: number) {
  return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

export default function DashboardPeerDetailPage() {
  const [, params] = useRoute("/dashboard/peers/:id");
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { peer, peerRow, isLoading, isError, error } = useMappedPeer(params?.id);
  const updatePeer = useUpdatePeerOrganization();
  const archivePeer = useArchivePeerOrganization();
  const deletePeer = useDeletePeerOrganization();
  const createRecord = useCreatePeerFundingRecord();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading peer organization…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">
          Could not load peer: {error instanceof Error ? error.message : String(error)}
        </div>
    );
  }

  if (!peer || !peerRow) {
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

  const handleEdit = async (values: PeerOrganizationFormValues) => {
    try {
      await updatePeer.mutateAsync({
        id: peer.id,
        updates: peerFormValuesToInsert(values),
      });
      toast({ title: "Peer updated", description: values.name });
      setEditOpen(false);
    } catch (e) {
      toast({
        title: "Failed to update peer",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

  const handleArchive = async () => {
    try {
      await archivePeer.mutateAsync(peer.id);
      toast({ title: "Peer archived", description: peer.name });
      setConfirmArchive(false);
      navigate("/dashboard/peers");
    } catch (e) {
      toast({
        title: "Failed to archive peer",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deletePeer.mutateAsync(peer.id);
      toast({ title: "Peer deleted", description: peer.name });
      setConfirmDelete(false);
      navigate("/dashboard/peers");
    } catch (e) {
      toast({
        title: "Failed to delete peer",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleAddRecord = async (values: PeerFundingRecordFormValues) => {
    try {
      await createRecord.mutateAsync(peerFundingRecordFormValuesToInsert(peer.id, values));
      toast({ title: "Funding record added" });
      setRecordDialogOpen(false);
    } catch (e) {
      toast({
        title: "Failed to add record",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      throw e;
    }
  };

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
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
          <Pencil size={12} />
          Edit
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConfirmArchive(true)}>
          <Archive size={12} />
          Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={12} />
          Delete
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
          <Button size="sm" variant="outline" className="gap-2 text-xs mt-2" onClick={() => setRecordDialogOpen(true)}>
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
              <Button size="sm" variant="outline" className="gap-2 text-xs mt-4" onClick={() => setEditOpen(true)}>
                Edit Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PeerOrganizationFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={peerRow}
        title="Edit peer organization"
        submitLabel="Save changes"
        loading={updatePeer.isPending}
      />

      <PeerFundingRecordFormDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        onSubmit={handleAddRecord}
        title="Add funding record"
        submitLabel="Add record"
        loading={createRecord.isPending}
      />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this peer organization?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{peer.name}&quot; will be archived and hidden from the peers list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this peer?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{peer.name}&quot; will be removed from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

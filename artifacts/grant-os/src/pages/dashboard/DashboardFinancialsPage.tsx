import { Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const STEPS = ["Import", "Map Awards", "Set Budgets", "View Summary"];

export default function DashboardFinancialsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Financials</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track grant-related budgets and expenses as this workspace matures.</p>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="h-9">
          <TabsTrigger value="expenses" className="text-xs">All Expenses</TabsTrigger>
          <TabsTrigger value="import" className="text-xs">Import Expenses</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <Wallet size={26} className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-medium text-slate-800">No expense ledger yet</div>
              <p className="text-xs text-slate-500 mt-1">Expense tracking will be added after award and budget workflows are defined.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="import" className="mt-4 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Expenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                <div className="text-sm font-medium text-slate-800">Upload expense file</div>
                <p className="text-xs text-slate-500 mt-1">CSV import is a placeholder for V0.7.2.</p>
                <Button size="sm" variant="outline" className="mt-4 text-xs" onClick={() => toast({ title: "Import placeholder", description: "Expense import is not implemented yet." })}>Choose file</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {STEPS.map((step, index) => (
                  <div key={step} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase text-slate-400">Step {index + 1}</div>
                    <div className="text-sm font-medium text-slate-900 mt-1">{step}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-8 text-sm text-slate-500">Budget categories, award mapping rules, and accounting integrations are planned for a later phase.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

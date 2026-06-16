import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grant OS</h1>
          <p className="text-sm text-slate-500">Access Pending</p>
        </div>

        <Card className="border-slate-200 shadow-sm text-center">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Your account is pending approval</CardTitle>
            <CardDescription className="text-sm">
              An administrator must approve your account before you can access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-md border border-amber-200">
              <p>We've received your request for <strong>{user?.email}</strong>.</p>
              <p className="mt-2 text-xs">You'll be able to sign in fully once an admin grants access.</p>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => void logout()}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          Need immediate access? Contact your team administrator.
        </p>
      </div>
    </div>
  );
}

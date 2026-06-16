import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();

  const isRejected = user?.access_status === "rejected";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grant OS</h1>
          <p className="text-sm text-slate-500">Access Denied</p>
        </div>

        <Card className="border-slate-200 shadow-sm text-center">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {isRejected ? "Access Request Rejected" : "Account Disabled"}
            </CardTitle>
            <CardDescription className="text-sm">
              {isRejected 
                ? "Your request to access Grant OS was not approved." 
                : "Your account has been disabled by an administrator."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 text-red-800 text-sm p-4 rounded-md border border-red-200">
              <p>The account <strong>{user?.email}</strong> does not have permission to access the dashboard.</p>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => void logout()}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          If you believe this is an error, please contact your team administrator.
        </p>
      </div>
    </div>
  );
}

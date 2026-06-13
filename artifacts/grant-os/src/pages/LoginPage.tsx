import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Chrome } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AuthProfileErrorScreen from "@/components/auth/AuthProfileErrorScreen";

type LoginPageProps = {
  mode?: "login" | "signup";
};

function getSafeNextPath(): string {
  if (typeof window === "undefined") return "/dashboard";
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api/")) return "/dashboard";
  return raw;
}

export default function LoginPage({ mode = "login" }: LoginPageProps) {
  const { login, loginWithGoogle, isAuthenticated, loading, profileError, hasSession } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nextPath = useMemo(() => getSafeNextPath(), []);
  const signupDisabled = mode === "signup";

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(nextPath);
    }
  }, [loading, isAuthenticated, navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      navigate(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError("");
    try {
      await loginWithGoogle(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in could not be started.");
      setGoogleSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Checking session…</p>
      </div>
    );
  }

  if (hasSession && profileError) {
    return <AuthProfileErrorScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grant OS</h1>
          <p className="text-sm text-slate-500">{signupDisabled ? "Request access to your workspace" : "Sign in to your dashboard"}</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{signupDisabled ? "Self-serve signup is disabled" : "Sign in"}</CardTitle>
            <CardDescription className="text-xs">
              {signupDisabled
                ? "Accounts are provisioned by an admin in Supabase. If you already have access, sign in below or continue with Google once it is configured."
                : "Use the email and password from your Supabase account, or continue with Google if your workspace has it enabled."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void handleGoogleSignIn()} disabled={googleSubmitting || submitting}>
                <Chrome size={16} />
                {googleSubmitting ? "Redirecting to Google…" : "Continue with Google"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wide text-slate-400">
                  <span className="bg-white px-2">or use email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="text-sm"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="text-sm"
                    autoComplete="current-password"
                  />
                </div>
                {(error || (!hasSession && profileError)) && (
                  <p className="text-xs text-red-600">{error || profileError}</p>
                )}
                <Button type="submit" className="w-full" disabled={submitting || googleSubmitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          New accounts are created by an admin in Supabase. Contact your team lead if you need access.
        </p>
      </div>
    </div>
  );
}

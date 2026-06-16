import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const resetUrl = typeof window !== "undefined" 
        ? `${window.location.origin}/reset-password`
        : "https://grant-os.replit.app/reset-password";
        
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });

      if (resetError) throw resetError;
      
      // Show safe success message even if email doesn't exist
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-6">
                If an account exists for {email}, you will receive a password reset link shortly.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Return to login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grant OS</h1>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Reset password</CardTitle>
            <CardDescription className="text-xs">
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
              
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
              
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending link…" : "Send reset link"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          Remembered your password? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

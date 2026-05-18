import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function AuthProfileErrorScreen() {
  const { profileError, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-medium text-slate-900">Cannot open dashboard</p>
        <p className="text-sm text-slate-600">{profileError}</p>
        <div className="flex flex-col gap-2 items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => void logout()}
          >
            Sign out
          </Button>
          <a href="/login" className="text-sm text-primary underline">
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}

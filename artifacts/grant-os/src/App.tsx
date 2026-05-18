import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import PublicLayout from "@/components/public/PublicLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";

import HomePage from "@/pages/HomePage";
import ProjectsPage from "@/pages/ProjectsPage";
import ConnectAppPage from "@/pages/ConnectAppPage";
import WorkshopsPage from "@/pages/WorkshopsPage";
import ProofPage from "@/pages/ProofPage";
import TeamPage from "@/pages/TeamPage";
import ContactPage from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/LoginPage";
import AuthProfileErrorScreen from "@/components/auth/AuthProfileErrorScreen";
import { authDebug } from "@/lib/authDebug";

import DashboardHomePage from "@/pages/dashboard/DashboardHomePage";
import DashboardTrackerPage from "@/pages/dashboard/DashboardTrackerPage";
import DashboardMatchesPage from "@/pages/dashboard/DashboardMatchesPage";
import DashboardMatchesProjectPage from "@/pages/dashboard/DashboardMatchesProjectPage";
import DashboardGrantsPage from "@/pages/dashboard/DashboardGrantsPage";
import DashboardGrantDetailPage from "@/pages/dashboard/DashboardGrantDetailPage";
import DashboardFundersPage from "@/pages/dashboard/DashboardFundersPage";
import DashboardFunderDetailPage from "@/pages/dashboard/DashboardFunderDetailPage";
import DashboardPeersPage from "@/pages/dashboard/DashboardPeersPage";
import DashboardPeerDetailPage from "@/pages/dashboard/DashboardPeerDetailPage";
import DashboardProjectsPage from "@/pages/dashboard/DashboardProjectsPage";
import DashboardProjectDetailPage from "@/pages/dashboard/DashboardProjectDetailPage";
import DashboardApplicationsPage from "@/pages/dashboard/DashboardApplicationsPage";
import DashboardApplicationDetailPage from "@/pages/dashboard/DashboardApplicationDetailPage";
import DashboardTasksPage from "@/pages/dashboard/DashboardTasksPage";
import DashboardProofItemsPage from "@/pages/dashboard/DashboardProofItemsPage";
import DashboardDocumentsPage from "@/pages/dashboard/DashboardDocumentsPage";
import DashboardReportsPage from "@/pages/dashboard/DashboardReportsPage";
import DashboardSettingsPage from "@/pages/dashboard/DashboardSettingsPage";

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading, profileError, hasSession } = useAuth();

  if (import.meta.env.DEV) {
    authDebug("ProtectedRoute", { loading, isAuthenticated, hasSession, profileError: !!profileError });
  }

  if (loading) return <AuthLoadingScreen />;
  if (profileError) return <AuthProfileErrorScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <DashboardShell>
      <Component />
    </DashboardShell>
  );
}

function Router() {
  const [location] = useLocation();
  const isDashboard = location.startsWith("/dashboard");
  const isLogin = location === "/login";

  if (isLogin) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
      </Switch>
    );
  }

  if (isDashboard) {
    return (
      <Switch>
        <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardHomePage} />} />
        <Route path="/dashboard/tracker" component={() => <ProtectedRoute component={DashboardTrackerPage} />} />
        <Route path="/dashboard/matches/:projectId" component={() => <ProtectedRoute component={DashboardMatchesProjectPage} />} />
        <Route path="/dashboard/matches" component={() => <ProtectedRoute component={DashboardMatchesPage} />} />
        <Route path="/dashboard/grants/:id" component={() => <ProtectedRoute component={DashboardGrantDetailPage} />} />
        <Route path="/dashboard/grants" component={() => <ProtectedRoute component={DashboardGrantsPage} />} />
        <Route path="/dashboard/funders/:id" component={() => <ProtectedRoute component={DashboardFunderDetailPage} />} />
        <Route path="/dashboard/funders" component={() => <ProtectedRoute component={DashboardFundersPage} />} />
        <Route path="/dashboard/peers/:id" component={() => <ProtectedRoute component={DashboardPeerDetailPage} />} />
        <Route path="/dashboard/peers" component={() => <ProtectedRoute component={DashboardPeersPage} />} />
        <Route path="/dashboard/projects/:slug" component={() => <ProtectedRoute component={DashboardProjectDetailPage} />} />
        <Route path="/dashboard/projects" component={() => <ProtectedRoute component={DashboardProjectsPage} />} />
        <Route path="/dashboard/applications/:id" component={() => <ProtectedRoute component={DashboardApplicationDetailPage} />} />
        <Route path="/dashboard/applications" component={() => <ProtectedRoute component={DashboardApplicationsPage} />} />
        <Route path="/dashboard/tasks" component={() => <ProtectedRoute component={DashboardTasksPage} />} />
        <Route path="/dashboard/proof-items" component={() => <ProtectedRoute component={DashboardProofItemsPage} />} />
        <Route path="/dashboard/documents" component={() => <ProtectedRoute component={DashboardDocumentsPage} />} />
        <Route path="/dashboard/reports" component={() => <ProtectedRoute component={DashboardReportsPage} />} />
        <Route path="/dashboard/settings" component={() => <ProtectedRoute component={DashboardSettingsPage} />} />
        <Route component={() => <ProtectedRoute component={NotFound} />} />
      </Switch>
    );
  }

  return (
    <PublicLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/projects/connect-app" component={ConnectAppPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/workshops" component={WorkshopsPage} />
        <Route path="/proof" component={ProofPage} />
        <Route path="/team" component={TeamPage} />
        <Route path="/contact" component={ContactPage} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

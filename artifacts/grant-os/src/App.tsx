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

// Fix #4: React Query safe defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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

// Fix #2: Create stable wrapper components instead of inline arrow functions.
// This prevents ProtectedRoute from being recreated on each render, which would
// unmount/remount DashboardShell and all children on every auth re-render.
function makeProtected(Page: React.ComponentType): React.ComponentType {
  function ProtectedPage() {
    return <ProtectedRoute component={Page} />;
  }
  ProtectedPage.displayName = `Protected(${Page.displayName || Page.name || "Component"})`;
  return ProtectedPage;
}

const ProtectedDashboardHome = makeProtected(DashboardHomePage);
const ProtectedDashboardTracker = makeProtected(DashboardTrackerPage);
const ProtectedDashboardMatchesProject = makeProtected(DashboardMatchesProjectPage);
const ProtectedDashboardMatches = makeProtected(DashboardMatchesPage);
const ProtectedDashboardGrantDetail = makeProtected(DashboardGrantDetailPage);
const ProtectedDashboardGrants = makeProtected(DashboardGrantsPage);
const ProtectedDashboardFunderDetail = makeProtected(DashboardFunderDetailPage);
const ProtectedDashboardFunders = makeProtected(DashboardFundersPage);
const ProtectedDashboardPeerDetail = makeProtected(DashboardPeerDetailPage);
const ProtectedDashboardPeers = makeProtected(DashboardPeersPage);
const ProtectedDashboardProjectDetail = makeProtected(DashboardProjectDetailPage);
const ProtectedDashboardProjects = makeProtected(DashboardProjectsPage);
const ProtectedDashboardApplicationDetail = makeProtected(DashboardApplicationDetailPage);
const ProtectedDashboardApplications = makeProtected(DashboardApplicationsPage);
const ProtectedDashboardTasks = makeProtected(DashboardTasksPage);
const ProtectedDashboardProofItems = makeProtected(DashboardProofItemsPage);
const ProtectedDashboardDocuments = makeProtected(DashboardDocumentsPage);
const ProtectedDashboardReports = makeProtected(DashboardReportsPage);
const ProtectedDashboardSettings = makeProtected(DashboardSettingsPage);
const ProtectedNotFound = makeProtected(NotFound);

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
        <Route path="/dashboard" component={ProtectedDashboardHome} />
        <Route path="/dashboard/tracker" component={ProtectedDashboardTracker} />
        <Route path="/dashboard/matches/:projectId" component={ProtectedDashboardMatchesProject} />
        <Route path="/dashboard/matches" component={ProtectedDashboardMatches} />
        <Route path="/dashboard/grants/:id" component={ProtectedDashboardGrantDetail} />
        <Route path="/dashboard/grants" component={ProtectedDashboardGrants} />
        <Route path="/dashboard/funders/:id" component={ProtectedDashboardFunderDetail} />
        <Route path="/dashboard/funders" component={ProtectedDashboardFunders} />
        <Route path="/dashboard/peers/:id" component={ProtectedDashboardPeerDetail} />
        <Route path="/dashboard/peers" component={ProtectedDashboardPeers} />
        <Route path="/dashboard/projects/:slug" component={ProtectedDashboardProjectDetail} />
        <Route path="/dashboard/projects" component={ProtectedDashboardProjects} />
        <Route path="/dashboard/applications/:id" component={ProtectedDashboardApplicationDetail} />
        <Route path="/dashboard/applications" component={ProtectedDashboardApplications} />
        <Route path="/dashboard/tasks" component={ProtectedDashboardTasks} />
        <Route path="/dashboard/proof-items" component={ProtectedDashboardProofItems} />
        <Route path="/dashboard/documents" component={ProtectedDashboardDocuments} />
        <Route path="/dashboard/reports" component={ProtectedDashboardReports} />
        <Route path="/dashboard/settings" component={ProtectedDashboardSettings} />
        <Route component={ProtectedNotFound} />
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

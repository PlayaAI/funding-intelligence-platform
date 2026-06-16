import { lazy, Suspense } from "react";
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
import PublicProjectDetailPage from "@/pages/PublicProjectDetailPage";
import WorkshopsPage from "@/pages/WorkshopsPage";
import ProofPage from "@/pages/ProofPage";
import TeamPage from "@/pages/TeamPage";
import ContactPage from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AuthProfileErrorScreen from "@/components/auth/AuthProfileErrorScreen";
import { authDebug } from "@/lib/authDebug";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const DashboardHomePage = lazy(() => import("@/pages/dashboard/DashboardHomePage"));
const DashboardTrackerPage = lazy(() => import("@/pages/dashboard/DashboardTrackerPage"));
const DashboardMatchesPage = lazy(() => import("@/pages/dashboard/DashboardMatchesPage"));
const DashboardMatchesProjectPage = lazy(() => import("@/pages/dashboard/DashboardMatchesProjectPage"));
const DashboardGrantsPage = lazy(() => import("@/pages/dashboard/DashboardGrantsPage"));
const DashboardGrantDetailPage = lazy(() => import("@/pages/dashboard/DashboardGrantDetailPage"));
const DashboardFundersPage = lazy(() => import("@/pages/dashboard/DashboardFundersPage"));
const DashboardFunderDetailPage = lazy(() => import("@/pages/dashboard/DashboardFunderDetailPage"));
const DashboardPeersPage = lazy(() => import("@/pages/dashboard/DashboardPeersPage"));
const DashboardPeerDetailPage = lazy(() => import("@/pages/dashboard/DashboardPeerDetailPage"));
const DashboardProjectsPage = lazy(() => import("@/pages/dashboard/DashboardProjectsPage"));
const DashboardProjectDetailPage = lazy(() => import("@/pages/dashboard/DashboardProjectDetailPage"));
const DashboardApplicationsPage = lazy(() => import("@/pages/dashboard/DashboardApplicationsPage"));
const DashboardApplicationDetailPage = lazy(() => import("@/pages/dashboard/DashboardApplicationDetailPage"));
const DashboardTasksPage = lazy(() => import("@/pages/dashboard/DashboardTasksPage"));
const DashboardProofItemsPage = lazy(() => import("@/pages/dashboard/DashboardProofItemsPage"));
const DashboardImportsPage = lazy(() => import("@/pages/dashboard/DashboardImportsPage"));
const DashboardTeamPage = lazy(() => import("@/pages/dashboard/DashboardTeamPage"));
const DashboardCustomFieldsPage = lazy(() => import("@/pages/dashboard/DashboardCustomFieldsPage"));
const DashboardCalendarPage = lazy(() => import("@/pages/dashboard/DashboardCalendarPage"));
const DashboardFinancialsPage = lazy(() => import("@/pages/dashboard/DashboardFinancialsPage"));
const DashboardDocumentsPage = lazy(() => import("@/pages/dashboard/DashboardDocumentsPage"));
const DashboardDocumentDetailPage = lazy(() => import("@/pages/dashboard/DashboardDocumentDetailPage"));
const DashboardReportsPage = lazy(() => import("@/pages/dashboard/DashboardReportsPage"));
const DashboardSettingsPage = lazy(() => import("@/pages/dashboard/DashboardSettingsPage"));
const DashboardAgentSettingsPage = lazy(() => import("@/pages/dashboard/DashboardAgentSettingsPage"));
const DashboardAgentKnowledgePage = lazy(() => import("@/pages/dashboard/DashboardAgentKnowledgePage"));
const DashboardAgentReportsPage = lazy(() => import("@/pages/dashboard/DashboardAgentReportsPage"));
const DashboardAgentActivityPage = lazy(() => import("@/pages/dashboard/DashboardAgentActivityPage"));
const DashboardAgentImportPage = lazy(() => import("@/pages/dashboard/DashboardAgentImportPage"));

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
  const { user, isAuthenticated, loading, profileError, hasSession } = useAuth();
  const [location] = useLocation();

  if (import.meta.env.DEV) {
    authDebug("ProtectedRoute", { loading, isAuthenticated, hasSession, profileError: !!profileError });
  }

  if (loading) return <AuthLoadingScreen />;
  if (profileError) return <AuthProfileErrorScreen />;
  if (!isAuthenticated || !user) {
    const next = encodeURIComponent(location || "/dashboard");
    return <Redirect to={`/login?next=${next}`} />;
  }

  if (user.access_status === "pending") {
    return <Redirect to="/pending-approval" />;
  }

  if (user.access_status === "rejected" || user.access_status === "disabled") {
    return <Redirect to="/access-denied" />;
  }

  return (
    <DashboardShell>
      <Suspense fallback={<AuthLoadingScreen />}>
        <Component />
      </Suspense>
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
const ProtectedDashboardImports = makeProtected(DashboardImportsPage);
const ProtectedDashboardTeam = makeProtected(DashboardTeamPage);
const ProtectedDashboardCustomFields = makeProtected(DashboardCustomFieldsPage);
const ProtectedDashboardCalendar = makeProtected(DashboardCalendarPage);
const ProtectedDashboardFinancials = makeProtected(DashboardFinancialsPage);
const ProtectedDashboardDocuments = makeProtected(DashboardDocumentsPage);
const ProtectedDashboardDocumentDetail = makeProtected(DashboardDocumentDetailPage);
const ProtectedDashboardReports = makeProtected(DashboardReportsPage);
const ProtectedDashboardSettings = makeProtected(DashboardSettingsPage);
const ProtectedDashboardAgentSettings = makeProtected(DashboardAgentSettingsPage);
const ProtectedDashboardAgentKnowledge = makeProtected(DashboardAgentKnowledgePage);
const ProtectedDashboardAgentReports = makeProtected(DashboardAgentReportsPage);
const ProtectedDashboardAgentActivity = makeProtected(DashboardAgentActivityPage);
const ProtectedDashboardAgentImport = makeProtected(DashboardAgentImportPage);
const ProtectedNotFound = makeProtected(NotFound);

function Router() {
  const [location] = useLocation();
  const isDashboard = location.startsWith("/dashboard");
  const isAuthRoute = 
    location === "/login" || 
    location === "/signup" ||
    location === "/forgot-password" ||
    location === "/reset-password" ||
    location === "/pending-approval" ||
    location === "/access-denied";

  if (isAuthRoute) {
    return (
      <Switch>
        <Route path="/login" component={() => <LoginPage />} />
        <Route path="/signup" component={() => <SignupPage />} />
        <Route path="/forgot-password" component={() => <ForgotPasswordPage />} />
        <Route path="/reset-password" component={() => <ResetPasswordPage />} />
        <Route path="/pending-approval" component={() => <PendingApprovalPage />} />
        <Route path="/access-denied" component={() => <AccessDeniedPage />} />
      </Switch>
    );
  }

  if (isDashboard) {
    return (
      <RouteErrorBoundary resetKey={location} dashboard>
        <Switch>
          <Route path="/dashboard" component={ProtectedDashboardHome} />
          <Route path="/dashboard/tracker" component={ProtectedDashboardTracker} />
          <Route path="/dashboard/matches/:projectId" component={ProtectedDashboardMatchesProject} />
          <Route path="/dashboard/matching" component={ProtectedDashboardMatches} />
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
          <Route path="/dashboard/imports" component={ProtectedDashboardImports} />
          <Route path="/dashboard/team" component={ProtectedDashboardTeam} />
          <Route path="/dashboard/custom-fields" component={ProtectedDashboardCustomFields} />
          <Route path="/dashboard/calendar" component={ProtectedDashboardCalendar} />
          <Route path="/dashboard/financials" component={ProtectedDashboardFinancials} />
          <Route path="/dashboard/documents/:id" component={ProtectedDashboardDocumentDetail} />
          <Route path="/dashboard/documents" component={ProtectedDashboardDocuments} />
          <Route path="/dashboard/reports" component={ProtectedDashboardReports} />
          <Route path="/dashboard/agent-knowledge" component={ProtectedDashboardAgentKnowledge} />
          <Route path="/dashboard/agent-reports" component={ProtectedDashboardAgentReports} />
          <Route path="/dashboard/agent-activity" component={ProtectedDashboardAgentActivity} />
          <Route path="/dashboard/agent-import" component={ProtectedDashboardAgentImport} />
          <Route path="/dashboard/settings/agents" component={ProtectedDashboardAgentSettings} />
          <Route path="/dashboard/settings" component={ProtectedDashboardSettings} />
          <Route component={ProtectedNotFound} />
        </Switch>
      </RouteErrorBoundary>
    );
  }

  return (
    <PublicLayout>
      <RouteErrorBoundary resetKey={location}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/projects/connect-app" component={ConnectAppPage} />
          <Route path="/projects/:slug" component={PublicProjectDetailPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/workshops" component={WorkshopsPage} />
          <Route path="/proof" component={ProofPage} />
          <Route path="/team" component={TeamPage} />
          <Route path="/contact" component={ContactPage} />
          <Route component={NotFound} />
        </Switch>
      </RouteErrorBoundary>
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

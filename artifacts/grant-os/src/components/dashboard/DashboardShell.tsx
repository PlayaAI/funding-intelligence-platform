import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/useProjects";
import { PROJECT_COLORS } from "@/data/grants";
import { useMappedGrants } from "@/hooks/useGrants";
import { tasks } from "@/data/tasks";
import { applications } from "@/data/applications";
import {
  LayoutDashboard,
  ListChecks,
  Sparkles,
  BookOpen,
  Building2,
  Network,
  FolderOpen,
  FileArchive,
  CheckSquare,
  Shield,
  Files,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ExternalLink,
  Search,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors relative group",
          active
            ? "bg-primary text-primary-foreground"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className={cn(
              "text-[11px] rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center leading-none",
              active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
            )}
          >
            {item.badge}
          </span>
        )}
        {collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
            {item.badge}
          </span>
        )}
        {collapsed && (
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
            {item.label}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickFind, setQuickFind] = useState("");
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: projects = [] } = useProjects();
  const { grants } = useMappedGrants();

  const openTasksCount = tasks.filter((t) => t.status !== "Complete").length;
  const activeAppsCount = applications.filter((a) => a.status !== "Submitted").length;
  const activeGrantsCount = grants.filter((g) =>
    ["Applying", "Submitted"].includes(g.status)
  ).length;

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} /> },
    { label: "Tracker", href: "/dashboard/tracker", icon: <ListChecks size={16} />, badge: activeGrantsCount },
    { label: "Matches", href: "/dashboard/matches", icon: <Sparkles size={16} /> },
    { label: "Grants", href: "/dashboard/grants", icon: <BookOpen size={16} /> },
    { label: "Funders", href: "/dashboard/funders", icon: <Building2 size={16} /> },
    { label: "Peer Orgs", href: "/dashboard/peers", icon: <Network size={16} /> },
    { label: "Projects", href: "/dashboard/projects", icon: <FolderOpen size={16} /> },
    { label: "Applications", href: "/dashboard/applications", icon: <FileArchive size={16} />, badge: activeAppsCount },
    { label: "Tasks", href: "/dashboard/tasks", icon: <CheckSquare size={16} />, badge: openTasksCount },
    { label: "Proof Library", href: "/dashboard/proof-items", icon: <Shield size={16} /> },
    { label: "Documents", href: "/dashboard/documents", icon: <Files size={16} /> },
    { label: "Reports", href: "/dashboard/reports", icon: <BarChart2 size={16} /> },
    { label: "Settings", href: "/dashboard/settings", icon: <Settings size={16} /> },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    return location.startsWith(href);
  };

  const filteredNavItems = quickFind
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(quickFind.toLowerCase())
      )
    : navItems;

  const filteredSidebarProjects = projects.slice(0, 4).filter(
    (p) => !quickFind || p.name.toLowerCase().includes(quickFind.toLowerCase())
  );

  const sidebarContent = (
    <aside
      className={cn(
        "flex flex-col bg-white border-r border-slate-200 h-full transition-all duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-slate-200 h-12 flex-shrink-0",
          collapsed ? "px-3 justify-center" : "px-3 gap-2"
        )}
      >
        {!collapsed && (
          <>
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              P
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm leading-tight truncate">Playa AI</div>
              <div className="text-[11px] text-primary font-semibold leading-tight">Grant OS</div>
            </div>
          </>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">
            P
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Quick find..."
              value={quickFind}
              onChange={(e) => setQuickFind(e.target.value)}
              className="pl-6 h-7 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            <Sparkles size={10} />
            <span className="font-semibold">Demo data</span>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-px">
        {filteredNavItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ))}
        {filteredNavItems.length === 0 && !collapsed && (
          <div className="px-2 py-3 text-xs text-slate-400 text-center">No matches.</div>
        )}
      </nav>

      {!collapsed && filteredSidebarProjects.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 px-0.5">
            Projects
          </div>
          <div className="space-y-px">
            {filteredSidebarProjects.map((p) => (
              <Link href={`/dashboard/projects/${p.slug}`} key={p.slug}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors",
                    location === `/dashboard/projects/${p.slug}` && "bg-slate-100 text-slate-900 font-medium"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PROJECT_COLORS[p.slug] ?? "#94a3b8" }}
                  />
                  <span className="truncate">{p.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 p-2 space-y-px flex-shrink-0">
        {!collapsed && user && (
          <div className="px-2 py-1.5 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {user.initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-500 truncate leading-tight">{user.email}</div>
                <div className="text-[10px] text-slate-400 truncate leading-tight">{user.role}</div>
              </div>
            </div>
          </div>
        )}
        <Link href="/">
          <div
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors",
              collapsed && "justify-center"
            )}
          >
            <ExternalLink size={13} className="flex-shrink-0" />
            {!collapsed && <span>Public site</span>}
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={13} className="flex-shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full hidden md:flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="hidden md:flex flex-col flex-shrink-0" style={{ width: collapsed ? 56 : 224 }}>
        {sidebarContent}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative flex flex-col" style={{ width: 224 }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-2.5 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="md:hidden flex items-center h-12 px-4 bg-white border-b border-slate-200 gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-slate-600">
            <Menu size={20} />
          </button>
          <div className="font-bold text-slate-900 text-sm">Grant OS</div>
        </div>
        {children}
      </main>
    </div>
  );
}

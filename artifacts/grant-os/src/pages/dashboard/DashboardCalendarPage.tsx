import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMappedGrants } from "@/hooks/useGrants";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { toast } from "@/hooks/use-toast";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: "grant" | "task";
  projectSlug?: string;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthDays(current: Date) {
  const year = current.getFullYear();
  const month = current.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function DashboardCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [projectFilter, setProjectFilter] = useState("all");
  const { grants } = useMappedGrants();
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const events = useMemo<CalendarEvent[]>(() => {
    const grantEvents = grants
      .filter((grant) => grant.deadline)
      .map((grant) => ({
        id: `grant-${grant.id}`,
        title: grant.title,
        date: grant.deadline,
        type: "grant" as const,
        projectSlug: grant.relatedProjectSlug,
      }));

    const taskEvents = tasks
      .filter((task) => task.due_date)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        date: task.due_date!,
        type: "task" as const,
        projectSlug: task.related_project_id ? projectById.get(task.related_project_id)?.slug : undefined,
      }));

    return [...grantEvents, ...taskEvents].filter((event) =>
      projectFilter === "all" ? true : event.projectSlug === projectFilter
    );
  }, [grants, projectById, projectFilter, tasks]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const existing = grouped.get(event.date) ?? [];
      existing.push(event);
      grouped.set(event.date, existing);
    });
    return grouped;
  }, [events]);

  const days = monthDays(currentMonth);
  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function shiftMonth(delta: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Grant deadlines and task due dates by month.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.slug}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => toast({ title: "Filters", description: "Advanced calendar filters are planned." })}>
            <Filter size={13} />
            Filter
          </Button>
          <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => toast({ title: "Share calendar", description: "External calendar sharing is not connected yet." })}>
            <Share2 size={13} />
            Share calendar
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Button>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <CalendarDays size={16} />
              {monthLabel}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Button>
          </div>

          <div className="grid grid-cols-7 border border-slate-200 rounded-md overflow-hidden bg-white">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-500">{day}</div>
            ))}
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const inMonth = day.getMonth() === currentMonth.getMonth();
              return (
                <div key={key} className={`min-h-28 border-b border-r border-slate-100 p-2 ${inMonth ? "bg-white" : "bg-slate-50 text-slate-400"}`}>
                  <div className="text-xs font-medium mb-1">{day.getDate()}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className={`truncate rounded px-1.5 py-1 text-[11px] ${event.type === "grant" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                        {event.type === "grant" ? "Grant" : "Task"}: {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[11px] text-slate-400">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

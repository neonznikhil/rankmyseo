import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  Layers,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  getArchivedProjects,
  getNetworkOverview,
  restoreProject,
} from "@/serverFunctions/projects";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { getLastProjectId } from "@/client/lib/active-project";
import { CreateProjectModal } from "@/client/features/projects/CreateProjectModal";
import type { ProjectNetworkItem } from "@/server/features/projects/services/NetworkOverviewService";

export const Route = createFileRoute("/_app/projects")({
  component: ProjectsPage,
});

function HealthScoreBadge({ score, status }: { score: number | null; status: ProjectNetworkItem["healthStatus"] }) {
  if (score === null || status === "unaudited") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-base-300/60 px-2 py-0.5 text-xs font-medium text-base-content/60">
        <Activity className="size-3 text-base-content/40" />
        Unaudited
      </span>
    );
  }

  if (score >= 80) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        {score} / 100
      </span>
    );
  }

  if (score >= 50) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-3" />
        {score} / 100
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
      <ShieldAlert className="size-3" />
      {score} / 100
    </span>
  );
}

function ProjectsPage() {
  const [creating, setCreating] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [currentProjectId, setCurrentProjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentProjectId(getLastProjectId());
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["network-overview"],
    queryFn: () => getNetworkOverview(),
  });

  const data = overviewQuery.data;
  const projects = React.useMemo(() => {
    if (!data?.projects) return [];
    if (!search.trim()) return data.projects;
    const q = search.toLowerCase();
    return data.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.domain && p.domain.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const totals = data?.totals ?? {
    totalProjects: 0,
    avgHealthScore: null,
    totalClicks28d: 0,
    totalCriticalIssues: 0,
    totalWarningIssues: 0,
  };

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-28 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight">Multi-Site Network</h1>
            </div>
            <p className="mt-1 text-sm text-base-content/60">
              Complete cross-site visibility into health scores, Google indexation status, 28-day organic traffic, and prioritized issues.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1.5"
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw className={`size-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-1.5 shadow-sm"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" />
              New project
            </button>
          </div>
        </div>

        {/* Network Metrics Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-base-content/60">
              <span>Total Sites</span>
              <Globe className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold">{totals.totalProjects}</div>
            <div className="mt-1 text-[11px] text-base-content/50">Active network projects</div>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-base-content/60">
              <span>Avg Health Score</span>
              <Activity className="size-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {totals.avgHealthScore !== null ? `${totals.avgHealthScore}/100` : "—"}
            </div>
            <div className="mt-1 text-[11px] text-base-content/50">Based on technical audits</div>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-base-content/60">
              <span>28-Day Clicks</span>
              <MousePointerClick className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {totals.totalClicks28d > 0 ? totals.totalClicks28d.toLocaleString() : "0"}
            </div>
            <div className="mt-1 text-[11px] text-base-content/50">Across connected GSC sites</div>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-base-content/60">
              <span>Critical Issues</span>
              <ShieldAlert className="size-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {totals.totalCriticalIssues}
            </div>
            <div className="mt-1 text-[11px] text-base-content/50">
              +{totals.totalWarningIssues} warnings require attention
            </div>
          </div>
        </div>

        {/* Network Sites Table Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                placeholder="Search sites or domains..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input input-bordered input-sm w-full pl-9"
              />
            </div>
            <div className="text-xs text-base-content/50">
              Showing {projects.length} of {totals.totalProjects} sites
            </div>
          </div>

          {overviewQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-base-300 bg-base-100">
              <span className="loading loading-spinner loading-md text-primary" />
              <p className="mt-3 text-sm text-base-content/60">Aggregating multi-site health, indexation & analytics...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-base-300 bg-base-100 p-12 text-center">
              <Globe className="mx-auto size-10 text-base-content/30" />
              <h3 className="mt-3 text-base font-semibold">No sites found</h3>
              <p className="mt-1 text-sm text-base-content/60">
                {search ? "No projects match your search criteria." : "Create your first project to begin monitoring your network."}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="btn btn-primary btn-sm mt-4 gap-1.5"
                >
                  <Plus className="size-4" />
                  Add First Site
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-300 bg-base-200/50 text-xs font-semibold text-base-content/70">
                    <th className="py-3 pl-4">Site / Project</th>
                    <th>Health</th>
                    <th>Indexation</th>
                    <th>28d Clicks</th>
                    <th>Open Issues</th>
                    <th>Priority Actions</th>
                    <th className="py-3 pr-4 text-right">Quick Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60">
                  {projects.map((site) => (
                    <tr key={site.id} className="hover:bg-base-200/30 transition-colors">
                      {/* Site Details */}
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/p/$projectId/search-performance"
                            params={{ projectId: site.id }}
                            className="font-medium hover:underline text-sm flex items-center gap-1.5"
                          >
                            {site.name}
                            {site.id === currentProjectId && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-primary">
                                Current
                              </span>
                            )}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-base-content/50">
                          {site.domain ? (
                            <span className="flex items-center gap-1">
                              <Globe className="size-3" />
                              {site.domain}
                            </span>
                          ) : (
                            <span className="italic">No domain configured</span>
                          )}
                        </div>
                      </td>

                      {/* Health Score */}
                      <td>
                        <HealthScoreBadge score={site.healthScore} status={site.healthStatus} />
                      </td>

                      {/* Indexation */}
                      <td>
                        {site.indexationRatio !== null ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold">{site.indexationRatio}%</span>
                              <span className="text-[11px] text-base-content/50">
                                {site.indexedPages} / {site.totalCrawledPages}
                              </span>
                            </div>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-base-200">
                              <div
                                className={`h-full rounded-full ${
                                  site.indexationRatio >= 85
                                    ? "bg-emerald-500"
                                    : site.indexationRatio >= 60
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(site.indexationRatio, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-base-content/40">—</span>
                        )}
                      </td>

                      {/* 28d Clicks */}
                      <td>
                        {site.clicks28d !== null ? (
                          <div>
                            <div className="font-semibold text-sm">
                              {site.clicks28d.toLocaleString()}
                            </div>
                            {site.impressions28d !== null && (
                              <div className="text-[11px] text-base-content/50">
                                {site.impressions28d.toLocaleString()} impr.
                              </div>
                            )}
                          </div>
                        ) : site.gscConnected ? (
                          <span className="text-xs text-base-content/40">Syncing...</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-base-200 px-1.5 py-0.5 text-[10px] text-base-content/50">
                            GSC Offline
                          </span>
                        )}
                      </td>

                      {/* Issues */}
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {site.criticalIssues > 0 ? (
                            <span className="badge badge-error badge-xs gap-1 text-[10px] font-semibold text-error-content py-2 px-1.5">
                              <ShieldAlert className="size-2.5" />
                              {site.criticalIssues} critical
                            </span>
                          ) : null}
                          {site.warningIssues > 0 ? (
                            <span className="badge badge-warning badge-xs gap-1 text-[10px] font-semibold text-warning-content py-2 px-1.5">
                              <AlertTriangle className="size-2.5" />
                              {site.warningIssues} warn
                            </span>
                          ) : null}
                          {site.criticalIssues === 0 && site.warningIssues === 0 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Clean
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Open Action Items */}
                      <td>
                        <span className="badge badge-neutral badge-sm text-xs font-medium">
                          {site.openActionItems} active
                        </span>
                      </td>

                      {/* Quick Links */}
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to="/p/$projectId/search-performance"
                            params={{ projectId: site.id }}
                            className="btn btn-ghost btn-xs gap-1"
                            title="Open Performance"
                          >
                            <span>Dashboard</span>
                            <ArrowUpRight className="size-3" />
                          </Link>
                          <Link
                            to="/p/$projectId/settings"
                            params={{ projectId: site.id }}
                            className="btn btn-ghost btn-xs"
                            title="Project Settings"
                          >
                            <ChevronRight className="size-3.5 text-base-content/50" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Archived Projects Accordion/Section */}
        <ArchivedProjects />
      </div>

      {creating ? (
        <CreateProjectModal onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

function ArchivedProjects() {
  const queryClient = useQueryClient();
  const archivedQuery = useQuery({
    queryKey: ["projects", "archived"],
    queryFn: () => getArchivedProjects(),
  });
  const archived = archivedQuery.data ?? [];

  const restoreMutation = useMutation({
    mutationFn: (projectId: string) =>
      restoreProject({ data: { archivedProjectId: projectId } }),
    onSuccess: async () => {
      // Prefix match invalidates both the active and archived lists.
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project restored");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Failed to restore project")),
  });

  if (archived.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-base-content/50">Archived</h2>
      <ul className="divide-y divide-base-300 overflow-hidden rounded-lg border border-base-300">
        {archived.map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-base-content/70">
                {project.name}
              </span>
              <span className="truncate text-xs text-base-content/50">
                {project.domain ?? "No domain set"}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm shrink-0"
              onClick={() => restoreMutation.mutate(project.id)}
              disabled={restoreMutation.isPending}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

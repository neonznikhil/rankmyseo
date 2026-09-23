import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  TrendingUp,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import {
  getPrioritizedActions,
  updateActionItemStatus,
} from "@/serverFunctions/actions";

interface Top10ActionFeedProps {
  projectId: string;
}

export function Top10ActionFeed({ projectId }: Top10ActionFeedProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["projectPrioritizedActions", projectId],
    queryFn: () => getPrioritizedActions({ data: { projectId } }),
  });

  const updateMutation = useMutation({
    mutationFn: (variables: {
      actionId: string;
      status: "pending" | "in_progress" | "resolved" | "dismissed";
    }) =>
      updateActionItemStatus({
        data: {
          projectId,
          actionId: variables.actionId,
          status: variables.status,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["projectPrioritizedActions", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["dashboardOverview", projectId],
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      getPrioritizedActions({
        data: { projectId, forceRefresh: true },
      }),
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["projectPrioritizedActions", projectId],
        newData,
      );
    },
  });

  const items = data?.items || [];
  const totalImpact = data?.totalPotentialClicks || 0;
  const inProgressCount = data?.inProgressCount || 0;
  const resolvedCount = data?.resolvedCount || 0;

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "ranking":
        return "badge-warning";
      case "technical":
        return "badge-info";
      case "content":
        return "badge-secondary";
      case "indexation":
        return "badge-primary";
      case "ux":
        return "badge-accent";
      default:
        return "badge-ghost";
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case "low":
        return "text-success bg-success/10 border-success/20";
      case "medium":
        return "text-warning bg-warning/10 border-warning/20";
      case "high":
        return "text-error bg-error/10 border-error/20";
      default:
        return "text-base-content/70 bg-base-200";
    }
  };

  return (
    <div className="card border border-base-200 bg-base-100 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="border-b border-base-200 bg-gradient-to-r from-primary/10 via-base-100 to-secondary/10 p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/20 p-2.5 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Prioritized Action Engine
                </h2>
                <span className="badge badge-primary badge-sm font-semibold">
                  Top 10 Now
                </span>
              </div>
              <p className="mt-1 text-sm text-base-content/70">
                Sorted by algorithmic traffic impact. Focus on these 10 actions
                to unlock immediate ranking and visitor growth.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || isFetching}
              className="btn btn-sm btn-ghost gap-1.5 border border-base-300"
              title="Rescan audit & GSC signals"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshMutation.isPending || isFetching ? "animate-spin" : ""}`}
              />
              <span>{refreshMutation.isPending ? "Rescanning..." : "Rescan"}</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-base-200 bg-base-100/80 p-3 shadow-xs">
            <div className="text-xs font-medium uppercase tracking-wider text-base-content/60">
              Est. Monthly Lift
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                +{totalImpact.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                visits
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-base-200 bg-base-100/80 p-3 shadow-xs">
            <div className="text-xs font-medium uppercase tracking-wider text-base-content/60">
              Active Queue
            </div>
            <div className="mt-1 text-xl font-black">
              {items.length} <span className="text-xs font-normal text-base-content/60">tasks</span>
            </div>
          </div>

          <div className="rounded-lg border border-base-200 bg-base-100/80 p-3 shadow-xs">
            <div className="text-xs font-medium uppercase tracking-wider text-base-content/60">
              In Progress
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xl font-black text-amber-500">
              <Clock className="h-5 w-5" />
              <span>{inProgressCount}</span>
            </div>
          </div>

          <div className="rounded-lg border border-base-200 bg-base-100/80 p-3 shadow-xs">
            <div className="text-xs font-medium uppercase tracking-wider text-base-content/60">
              Resolved Fixed
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xl font-black text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span>{resolvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action List Body */}
      <div className="divide-y divide-base-200">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-6" aria-busy>
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-success/20 p-4 text-success">
              <Sparkles className="h-8 w-8" />
            </div>
            <h3 className="mt-3 text-lg font-bold">All 10 Actions Complete!</h3>
            <p className="mt-1 max-w-md text-sm text-base-content/70">
              Outstanding work. Your high-priority queue is clear. Click Rescan
              to audit new crawl pages and fresh keyword rank changes.
            </p>
            <button
              onClick={() => refreshMutation.mutate()}
              className="btn btn-primary btn-sm mt-4 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Run Fresh Site Scan
            </button>
          </div>
        ) : (
          items.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const isWorking = item.status === "in_progress";

            return (
              <div
                key={item.id}
                className={`p-4 transition-colors md:p-5 hover:bg-base-200/40 ${
                  isWorking ? "bg-amber-500/5" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-300 text-xs font-black">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge badge-sm font-semibold uppercase ${getCategoryBadge(item.category)}`}>
                          {item.category}
                        </span>
                        <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold uppercase ${getEffortBadge(item.effort)}`}>
                          {item.effort} effort
                        </span>
                        {isWorking && (
                          <span className="badge badge-warning badge-sm gap-1">
                            <Clock className="h-3 w-3" /> In Progress
                          </span>
                        )}
                      </div>

                      <h4 className="mt-1 text-base font-semibold">
                        {item.title}
                      </h4>

                      <p className="mt-1 text-sm text-base-content/70">
                        {item.description}
                      </p>

                      {item.targetUrl && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-base-content/60">
                          <span className="font-semibold">Target URL:</span>
                          <a
                            href={item.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:text-primary hover:underline"
                          >
                            {item.targetUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                      <span>+{item.estimatedTrafficImpact} visits/mo</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isWorking ? (
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              actionId: item.id,
                              status: "resolved",
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="btn btn-success btn-xs gap-1 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Done
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              actionId: item.id,
                              status: "in_progress",
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="btn btn-primary btn-xs gap-1"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Start Fix
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                        className="btn btn-ghost btn-xs btn-square"
                        title="View fix instructions"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            actionId: item.id,
                            status: "dismissed",
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
                        title="Dismiss action"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Fix Details */}
                {isExpanded && (
                  <div className="mt-4 rounded-lg border border-base-200 bg-base-200/50 p-4 text-sm">
                    <div className="font-semibold text-primary">
                      Recommended Engineering Execution:
                    </div>
                    <p className="mt-1 text-base-content/80">
                      {item.recommendedAction}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-base-content/60">
                      <span>Source: {item.source.toUpperCase()} Engine</span>
                      <div className="flex gap-2">
                        {!isWorking && (
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                actionId: item.id,
                                status: "in_progress",
                              })
                            }
                            className="btn btn-outline btn-xs"
                          >
                            Mark In Progress
                          </button>
                        )}
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              actionId: item.id,
                              status: "resolved",
                            })
                          }
                          className="btn btn-success btn-xs text-white"
                        >
                          Complete & Verify
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

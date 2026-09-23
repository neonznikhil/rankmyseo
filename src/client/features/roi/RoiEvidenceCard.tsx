import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
} from "lucide-react";
import {
  getRoiSummary,
  trackCustomFix,
  refreshRemediation,
} from "@/serverFunctions/roi";

interface RoiEvidenceCardProps {
  projectId: string;
}

export function RoiEvidenceCard({ projectId }: RoiEvidenceCardProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [actionDesc, setActionDesc] = useState("");
  const [baselineClicks, setBaselineClicks] = useState<number | "">("");
  const [baselineRank, setBaselineRank] = useState<number | "">("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["roiSummary", projectId],
    queryFn: () => getRoiSummary({ data: { projectId } }),
  });

  const trackMutation = useMutation({
    mutationFn: () =>
      trackCustomFix({
        data: {
          projectId,
          targetUrl: targetUrl.trim(),
          actionDescription: actionDesc.trim(),
          baselineClicks: baselineClicks === "" ? undefined : Number(baselineClicks),
          baselineRank: baselineRank === "" ? undefined : Number(baselineRank),
        },
      }),
    onSuccess: () => {
      setTargetUrl("");
      setActionDesc("");
      setBaselineClicks("");
      setBaselineRank("");
      setIsAdding(false);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ["roiSummary", projectId] });
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || "Failed to start 28-day tracking for this URL.");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (remediationId: string) =>
      refreshRemediation({
        data: {
          projectId,
          remediationId,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roiSummary", projectId] });
    },
  });

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim() || !actionDesc.trim()) return;
    trackMutation.mutate();
  };

  const items = data?.items || [];
  const totalLift = data?.totalNetClicksLift || 0;
  const avgPosGain = data?.averagePositionImprovement || 0;
  const totalValue = data?.totalPipelineValueCreated || 0;
  const winRate = data?.successRatePct ?? 100;
  const activeCount = data?.activeTrackingCount || 0;
  const completedCount = data?.completedTrackingCount || 0;

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-base-200 bg-base-100/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10 text-success">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-base-content">
                  Prove the Work: 28-Day Impact & ROI Proof
                </h3>
                <span className="badge badge-sm badge-success text-success-content font-bold">
                  {completedCount} Verified
                </span>
                {activeCount > 0 && (
                  <span className="badge badge-sm badge-outline text-info border-info/30">
                    {activeCount} Tracking Active
                  </span>
                )}
              </div>
              <p className="text-xs text-base-content/70 mt-0.5">
                Every optimization shipped is tracked for 28 days to measure organic clicks lift, rank jumps, and pipeline revenue created.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="btn btn-sm btn-outline btn-success gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Track Custom Fix
            </button>
          </div>
        </div>

        {/* Track Custom Fix Form */}
        {isAdding && (
          <form
            onSubmit={handleTrackSubmit}
            className="mt-4 p-4 rounded-xl bg-base-200/50 border border-base-300 animate-fadeIn"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-base-content/70 mb-2">
              Track 28-Day Lift for URL Fix
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="text-[11px] font-medium text-base-content/70">
                  Target URL
                </label>
                <input
                  type="url"
                  placeholder="https://yourdomain.com/landing-page"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="input input-sm input-bordered w-full mt-1"
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-[11px] font-medium text-base-content/70">
                  Action Taken (Fix Description)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rewrote H1 & Title for target intent"
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  className="input input-sm input-bordered w-full mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-base-content/70">
                  Baseline 28d Clicks (optional)
                </label>
                <input
                  type="number"
                  placeholder="50"
                  value={baselineClicks}
                  onChange={(e) =>
                    setBaselineClicks(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="input input-sm input-bordered w-full mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-base-content/70">
                  Baseline Avg Rank (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="14.2"
                  value={baselineRank}
                  onChange={(e) =>
                    setBaselineRank(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="input input-sm input-bordered w-full mt-1"
                />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <button
                  type="submit"
                  disabled={trackMutation.isPending || !targetUrl.trim() || !actionDesc.trim()}
                  className="btn btn-sm btn-success flex-1 text-success-content"
                >
                  {trackMutation.isPending ? "Starting 28d Watch..." : "Begin 28-Day Tracking"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
            {errorMsg && (
              <div className="text-xs text-error mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {errorMsg}
              </div>
            )}
          </form>
        )}

        {/* Top Proof ROI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-base-200/70">
          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Net Organic Click Lift
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-success">
                +{totalLift.toLocaleString()}
              </span>
              <span className="text-xs text-base-content/60">
                post-fix clicks
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Avg Position Jump
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-primary">
                +{avgPosGain}
              </span>
              <span className="text-xs text-base-content/60">
                ranks gained
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Pipeline Value Created
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-base-content">
                ${totalValue.toLocaleString()}
              </span>
              <span className="text-xs text-base-content/60">
                attributed ROI
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Remediation Win Rate
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-success">
                {winRate}%
              </span>
              <span className="text-xs text-base-content/60">
                positive lift
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Remediation Cards & Evidence Table */}
      <div className="p-5">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-base-content/60">
            <span className="loading loading-spinner loading-md text-success"></span>
            <span className="text-xs mt-3">
              Calculating 28-day post-fix performance lift and revenue attribution...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-base-content/60">
            <ShieldCheck className="w-9 h-9 text-base-content/30 mx-auto mb-2" />
            <p className="text-sm font-semibold">
              No remediations tracked yet
            </p>
            <p className="text-xs text-base-content/50 mt-1 max-w-md mx-auto">
              Whenever you ship a fix from the Prioritized Actions or apply a live modification, it automatically enters 28-day ROI tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isFinished = item.status === "completed";
              const isPositive = item.clickLift > 0 || (item.positionGain !== null && item.positionGain > 0);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-base-200 bg-base-100 hover:border-base-300 transition-all space-y-3"
                >
                  {/* Top line: URL + Status badge + Lift badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isFinished ? (
                          <span className="badge badge-sm badge-success font-semibold gap-1 text-success-content">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            28-Day Lift Proved
                          </span>
                        ) : (
                          <span className="badge badge-sm badge-info font-semibold gap-1 text-info-content">
                            <Clock className="w-3.5 h-3.5" />
                            Day {item.daysTracked} of 28
                          </span>
                        )}

                        <span className="text-xs font-semibold text-base-content truncate">
                          {item.actionDescription}
                        </span>
                      </div>

                      <a
                        href={item.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary/80 hover:text-primary hover:underline flex items-center gap-1 mt-1 truncate"
                      >
                        {item.targetUrl}
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-base-content">
                          Value Generated
                        </div>
                        <div className="text-sm font-bold text-success">
                          +${item.estimatedValueCreated.toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => refreshMutation.mutate(item.id)}
                        disabled={refreshMutation.isPending}
                        className="btn btn-xs btn-ghost gap-1"
                        title="Recalculate lift from fresh search data"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            refreshMutation.isPending ? "animate-spin" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 28-Day Timeline Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-base-content/60 mb-1">
                      <span>
                        Applied: {new Date(item.appliedAt).toLocaleDateString()}
                      </span>
                      <span className="font-medium">
                        {isFinished
                          ? "Full 28-day window observed"
                          : `${item.daysRemaining} days remaining`}
                      </span>
                      <span>
                        Concludes: {new Date(item.trackingEndAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFinished ? "bg-success" : "bg-info"
                        }`}
                        style={{ width: `${item.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Comparison Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-base-200/60 text-xs">
                    <div className="p-2 rounded bg-base-200/40">
                      <div className="text-[10px] uppercase font-semibold text-base-content/50">
                        28d Organic Clicks
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base-content/70">
                          {item.preClicks28d}
                        </span>
                        <span className="text-base-content/40">&rarr;</span>
                        <span className="font-bold text-base-content">
                          {item.postClicks28d}
                        </span>
                        <span
                          className={`ml-1 text-[11px] font-bold ${
                            item.clickLift >= 0 ? "text-success" : "text-error"
                          }`}
                        >
                          ({item.clickLift >= 0 ? `+${item.clickLift}` : item.clickLift})
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-base-200/40">
                      <div className="text-[10px] uppercase font-semibold text-base-content/50">
                        Average SERP Rank
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base-content/70">
                          #{item.prePositionAvg || "N/A"}
                        </span>
                        <span className="text-base-content/40">&rarr;</span>
                        <span className="font-bold text-base-content">
                          #{item.postPositionAvg || "N/A"}
                        </span>
                        {item.positionGain !== null && item.positionGain > 0 && (
                          <span className="ml-1 text-[11px] font-bold text-success">
                            (+{item.positionGain})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2 rounded bg-base-200/40">
                      <div className="text-[10px] uppercase font-semibold text-base-content/50">
                        Organic Lift Rate
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span
                          className={`font-bold ${
                            item.clickLiftPct >= 0 ? "text-success" : "text-error"
                          }`}
                        >
                          {item.clickLiftPct >= 0 ? `+${item.clickLiftPct}%` : `${item.clickLiftPct}%`}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-base-200/40">
                      <div className="text-[10px] uppercase font-semibold text-base-content/50">
                        Observed Status
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 font-medium text-base-content">
                        {isPositive ? (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                            <span className="text-success font-semibold">Positive Lift</span>
                          </>
                        ) : (
                          <span className="text-base-content/60">Stabilizing</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  FileText,
  AlertTriangle,
  Award,
  ExternalLink,
  Search,
  Sparkles,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import {
  getCompetitorIntelligence,
  addCompetitorDomain,
  removeCompetitorDomain,
} from "@/serverFunctions/competitors";

interface CompetitorIntelligenceCardProps {
  projectId: string;
}

export function CompetitorIntelligenceCard({
  projectId,
}: CompetitorIntelligenceCardProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "sov" | "outrank" | "new_pages" | "manage"
  >("sov");
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["competitorIntelligence", projectId],
    queryFn: () => getCompetitorIntelligence({ data: { projectId } }),
  });

  const addMutation = useMutation({
    mutationFn: (variables: { domain: string; name?: string }) =>
      addCompetitorDomain({
        data: {
          projectId,
          domain: variables.domain,
          name: variables.name || undefined,
        },
      }),
    onSuccess: () => {
      setNewDomain("");
      setNewName("");
      setIsAdding(false);
      setAddError(null);
      void queryClient.invalidateQueries({
        queryKey: ["competitorIntelligence", projectId],
      });
    },
    onError: (err: any) => {
      setAddError(err?.message || "Failed to add competitor domain");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (competitorId: string) =>
      removeCompetitorDomain({
        data: {
          projectId,
          competitorId,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["competitorIntelligence", projectId],
      });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    addMutation.mutate({
      domain: newDomain.trim(),
      name: newName.trim() || undefined,
    });
  };

  const projectDomain = data?.projectDomain || "yourdomain.com";
  const competitors = data?.competitors || [];
  const shareOfVoice = data?.shareOfVoice || [];
  const outrankGaps = data?.outrankGaps || [];
  const newPages = data?.newPages || [];
  const totalKeywords = data?.totalTrackedKeywords || 0;
  const marketLeader = data?.marketLeader;

  // Calculate your SOV
  const yourSov =
    shareOfVoice.find((s) => s.isProjectDomain)?.shareOfVoicePct || 0;
  const yourTop10 =
    shareOfVoice.find((s) => s.isProjectDomain)?.top10Count || 0;

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-base-200 bg-base-100/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-base-content">
                  Competitor Intelligence & Share of Voice
                </h3>
                <span className="badge badge-sm badge-outline text-primary border-primary/30">
                  {competitors.length} Competitors
                </span>
              </div>
              <p className="text-xs text-base-content/70 mt-0.5">
                Market visibility, outranking gap analysis, and newly detected
                competitor content.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="btn btn-sm btn-primary gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Competitor
            </button>
          </div>
        </div>

        {/* Add Competitor Dropdown Form */}
        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="mt-4 p-4 rounded-xl bg-base-200/50 border border-base-300 animate-fadeIn"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-base-content/70 mb-2">
              Track New Competitor Domain
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="e.g. competitor.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="input input-sm input-bordered w-full"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Display Name (optional)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input input-sm input-bordered w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending || !newDomain.trim()}
                  className="btn btn-sm btn-primary flex-1"
                >
                  {addMutation.isPending ? "Adding..." : "Start Tracking"}
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
            {addError && (
              <div className="text-xs text-error mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {addError}
              </div>
            )}
          </form>
        )}

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-base-200/70">
          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Your Share of Voice
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-base-content">
                {yourSov}%
              </span>
              <span className="text-xs text-base-content/60">
                ({yourTop10} Top 10s)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Market Leader
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 truncate">
              <Award className="w-4 h-4 text-warning shrink-0" />
              <span className="text-sm font-semibold truncate text-base-content">
                {marketLeader?.domain || "N/A"}
              </span>
              <span className="text-xs font-mono text-base-content/60">
                ({marketLeader?.shareOfVoicePct || 0}%)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              Outrank Gaps
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-warning">
                {outrankGaps.length}
              </span>
              <span className="text-xs text-base-content/60">
                keywords where competitors beat you
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-base-200/40">
            <span className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider">
              New Competitor Pages
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-info">
                {newPages.length}
              </span>
              <span className="text-xs text-base-content/60">
                published recently
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto border-b border-base-200">
          <button
            onClick={() => setActiveTab("sov")}
            className={`btn btn-sm btn-ghost gap-1.5 border-b-2 rounded-b-none ${
              activeTab === "sov"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-base-content/70"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Share of Voice ({shareOfVoice.length})
          </button>
          <button
            onClick={() => setActiveTab("outrank")}
            className={`btn btn-sm btn-ghost gap-1.5 border-b-2 rounded-b-none ${
              activeTab === "outrank"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-base-content/70"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-warning" />
            Where They Outrank You ({outrankGaps.length})
          </button>
          <button
            onClick={() => setActiveTab("new_pages")}
            className={`btn btn-sm btn-ghost gap-1.5 border-b-2 rounded-b-none ${
              activeTab === "new_pages"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-base-content/70"
            }`}
          >
            <FileText className="w-4 h-4 text-info" />
            Their New Pages ({newPages.length})
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`btn btn-sm btn-ghost gap-1.5 border-b-2 rounded-b-none ${
              activeTab === "manage"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-base-content/70"
            }`}
          >
            <Globe className="w-4 h-4" />
            Competitors ({competitors.length})
          </button>
        </div>
      </div>

      {/* Body Content based on Active Tab */}
      <div className="p-5">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-base-content/60">
            <span className="loading loading-spinner loading-md text-primary"></span>
            <span className="text-xs mt-3">
              Calculating Share of Voice & crawling competitor SERPs...
            </span>
          </div>
        ) : (
          <>
            {/* 1. Share of Voice Tab */}
            {activeTab === "sov" && (
              <div className="space-y-4">
                <div className="text-xs text-base-content/70 mb-2">
                  Share of Voice is calculated by weighted CTR across all {totalKeywords} tracked keywords. Higher percentage indicates greater search dominance.
                </div>

                {shareOfVoice.map((sov, index) => {
                  const isUser = sov.isProjectDomain;
                  return (
                    <div
                      key={sov.domain}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isUser
                          ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                          : "bg-base-100 border-base-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono font-bold text-base-content/50 w-5">
                            #{index + 1}
                          </span>
                          <span
                            className={`font-semibold text-sm truncate ${
                              isUser ? "text-primary" : "text-base-content"
                            }`}
                          >
                            {sov.domain}
                          </span>
                          {isUser && (
                            <span className="badge badge-xs badge-primary">
                              You
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs shrink-0">
                          <div className="hidden sm:block text-base-content/70">
                            Avg Rank:{" "}
                            <span className="font-semibold text-base-content">
                              {sov.averagePosition > 0
                                ? `#${sov.averagePosition}`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="hidden sm:block text-base-content/70">
                            Top 3:{" "}
                            <span className="font-semibold text-base-content">
                              {sov.top3Count}
                            </span>
                          </div>
                          <div className="hidden sm:block text-base-content/70">
                            Top 10:{" "}
                            <span className="font-semibold text-base-content">
                              {sov.top10Count}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-bold text-base-content">
                              {sov.shareOfVoicePct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-base-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isUser ? "bg-primary" : "bg-base-content/30"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(2, sov.shareOfVoicePct))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Where They Outrank You Tab */}
            {activeTab === "outrank" && (
              <div>
                {outrankGaps.length === 0 ? (
                  <div className="py-10 text-center text-base-content/60">
                    <Award className="w-8 h-8 text-success mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold">
                      No outrank gaps detected!
                    </p>
                    <p className="text-xs text-base-content/50 mt-1">
                      Your domain holds the top position across all tracked
                      competitors.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr className="border-b border-base-200 text-xs text-base-content/60">
                          <th>Keyword</th>
                          <th>Vol</th>
                          <th>Your Rank</th>
                          <th>Competitor Rank</th>
                          <th>Gap</th>
                          <th>Traffic Lost</th>
                          <th>Remedy Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outrankGaps.map((gap, i) => (
                          <tr
                            key={`${gap.keyword}-${gap.competitorDomain}-${i}`}
                            className="hover:bg-base-200/40 text-xs"
                          >
                            <td className="font-medium text-base-content">
                              {gap.keyword}
                            </td>
                            <td className="font-mono text-base-content/70">
                              {gap.searchVolume.toLocaleString()}
                            </td>
                            <td>
                              {gap.yourPosition !== null ? (
                                <span className="badge badge-sm badge-ghost font-mono">
                                  #{gap.yourPosition}
                                </span>
                              ) : (
                                <span className="text-base-content/40">
                                  &gt;50
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <span className="badge badge-sm badge-warning font-mono font-bold">
                                  #{gap.competitorPosition}
                                </span>
                                <span className="text-base-content/70 text-[11px] truncate max-w-[120px]">
                                  {gap.competitorDomain}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="text-warning font-bold flex items-center gap-0.5">
                                <TrendingDown className="w-3.5 h-3.5" />+
                                {gap.positionGap}
                              </span>
                            </td>
                            <td className="font-bold text-error">
                              ~{gap.estimatedTrafficLost} clicks/mo
                            </td>
                            <td className="text-base-content/80 text-[11px] max-w-[280px]">
                              {gap.remedyAction}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. Their New Pages Tab */}
            {activeTab === "new_pages" && (
              <div>
                {newPages.length === 0 ? (
                  <div className="py-10 text-center text-base-content/60">
                    <FileText className="w-8 h-8 text-base-content/30 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      No new competitor pages detected yet
                    </p>
                    <p className="text-xs text-base-content/50 mt-1">
                      As competitors publish new URLs, they will appear here with
                      days-ago recency.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newPages.map((page) => (
                      <div
                        key={page.id}
                        className="p-3 rounded-lg border border-base-200 bg-base-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-base-300 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="badge badge-xs badge-info font-mono">
                              {page.competitorDomain}
                            </span>
                            <span className="text-[11px] text-base-content/50">
                              Detected {page.daysAgo === 0 ? "today" : `${page.daysAgo}d ago`}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-base-content truncate">
                            {page.title || page.url}
                          </div>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary/80 hover:text-primary hover:underline truncate flex items-center gap-1 mt-0.5"
                          >
                            {page.url}
                            <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Competitor Domains Management Tab */}
            {activeTab === "manage" && (
              <div className="space-y-3">
                {competitors.length === 0 ? (
                  <div className="py-8 text-center text-base-content/60">
                    <Globe className="w-8 h-8 text-base-content/30 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      No competitor domains added yet
                    </p>
                    <p className="text-xs text-base-content/50 mt-1">
                      Click &quot;Add Competitor&quot; above to start benchmarking your
                      keyword set against rival domains.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr className="border-b border-base-200 text-xs text-base-content/60">
                          <th>Domain</th>
                          <th>Name</th>
                          <th>Share of Voice</th>
                          <th>Avg Rank</th>
                          <th>Keywords Ranked</th>
                          <th>Outranks You</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map((comp) => (
                          <tr key={comp.id} className="hover:bg-base-200/40 text-xs">
                            <td className="font-semibold text-base-content">
                              {comp.domain}
                            </td>
                            <td className="text-base-content/70">
                              {comp.name || "-"}
                            </td>
                            <td className="font-bold text-primary">
                              {comp.shareOfVoicePct}%
                            </td>
                            <td className="font-mono">
                              {comp.averagePosition > 0
                                ? `#${comp.averagePosition}`
                                : "N/A"}
                            </td>
                            <td className="font-mono">
                              {comp.keywordsRankedCount}
                            </td>
                            <td className="font-mono text-warning font-semibold">
                              {comp.outrankCount}
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => removeMutation.mutate(comp.id)}
                                disabled={removeMutation.isPending}
                                className="btn btn-xs btn-ghost text-error hover:bg-error/10"
                                title="Remove competitor"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCode,
  Globe,
  History,
  Loader2,
  RotateCcw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSiteChangeLog,
  rollbackSiteModification,
} from "@/serverFunctions/guardrails";
import {
  DiffPreviewModal,
  type DiffPreviewData,
} from "@/client/features/guardrails/DiffPreviewModal";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

interface ChangeLogTableProps {
  projectId: string;
}

export function ChangeLogTable({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<DiffPreviewData | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const changeLogQuery = useQuery({
    queryKey: ["siteChangeLog", projectId],
    queryFn: () => getSiteChangeLog({ data: { projectId } }),
  });

  const list = changeLogQuery.data ?? [];

  const filteredList = list.filter((item) => {
    if (statusFilter === "all") return true;
    return item.status === statusFilter;
  });

  const handleRollback = async (modificationId: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to undo "${title}"? This will immediately revert the live page changes and halt 28-day tracking.`,
    );
    if (!confirmed) return;

    try {
      setRevertingId(modificationId);
      await rollbackSiteModification({
        data: { projectId, modificationId },
      });
      toast.success(`Successfully rolled back: ${title}`);
      await queryClient.invalidateQueries({
        queryKey: ["siteChangeLog", projectId],
      });
    } catch (err) {
      toast.error(getStandardErrorMessage(err, "Failed to rollback modification"));
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="size-5 text-primary" />
            Audit Log & Rollback Engine
          </h2>
          <p className="text-xs text-base-content/60">
            Immutable log of all automated metadata, heading, and content patches with instant one-click rollback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses ({list.length})</option>
            <option value="applied">Live Applied ({list.filter((i) => i.status === "applied").length})</option>
            <option value="reverted">Reverted / Undone ({list.filter((i) => i.status === "reverted").length})</option>
            <option value="preview">Staged Preview ({list.filter((i) => i.status === "preview").length})</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
        {changeLogQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-base-content/60">
            <Loader2 className="size-5 animate-spin text-primary" />
            Loading live change log...
          </div>
        ) : changeLogQuery.isError ? (
          <div className="p-6">
            <div className="alert alert-error text-xs">
              {getStandardErrorMessage(changeLogQuery.error)}
            </div>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Shield className="size-10 mx-auto text-base-content/30" />
            <h3 className="font-semibold text-sm">No site modifications found</h3>
            <p className="text-xs text-base-content/60 max-w-sm mx-auto">
              When automated fixes are generated from the Prioritized Action List, their live diffs and rollback states will appear here.
            </p>
          </div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr className="bg-base-200/50 text-xs">
                <th>Modification & URL</th>
                <th>Type</th>
                <th>YMYL Risk</th>
                <th>Status</th>
                <th>Timeline</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((item) => {
                const isApplied = item.status === "applied";
                const isReverted = item.status === "reverted";
                const isPreview = item.status === "preview";
                const isHighRisk = item.ymylRiskLevel === "high_risk";
                const isCaution = item.ymylRiskLevel === "caution";

                return (
                  <tr key={item.id} className="hover">
                    <td className="max-w-xs">
                      <div className="font-semibold text-sm truncate">{item.title}</div>
                      <div className="flex items-center gap-1.5 text-xs text-base-content/60 truncate">
                        <Globe className="size-3 shrink-0" />
                        <span className="truncate">{item.targetUrl}</span>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-sm badge-ghost font-mono uppercase text-[10px]">
                        {item.modificationType.replace("_", " ")}
                      </span>
                    </td>

                    <td>
                      <div className="flex items-center gap-1.5">
                        {isHighRisk ? (
                          <ShieldAlert className="size-4 text-error" />
                        ) : isCaution ? (
                          <AlertTriangle className="size-4 text-warning" />
                        ) : (
                          <CheckCircle2 className="size-4 text-success" />
                        )}
                        <span
                          className={`badge badge-xs font-semibold uppercase ${
                            isHighRisk
                              ? "badge-error"
                              : isCaution
                                ? "badge-warning"
                                : "badge-success text-white"
                          }`}
                        >
                          {item.ymylRiskLevel.replace("_", " ")}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge badge-sm font-semibold capitalize ${
                          isApplied
                            ? "badge-success text-white"
                            : isReverted
                              ? "badge-neutral"
                              : "badge-warning"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="text-xs text-base-content/70">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-base-content/40" />
                        <span>
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {item.revertedAt && (
                        <div className="text-[11px] text-error font-medium">
                          Reverted {new Date(item.revertedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={() =>
                            setSelectedItem({
                              id: item.id,
                              projectId: item.projectId,
                              title: item.title,
                              targetUrl: item.targetUrl,
                              modificationType: item.modificationType,
                              beforePayload: item.beforePayload,
                              afterPayload: item.afterPayload,
                              diffPreview: item.diffPreview,
                              ymylRiskLevel: item.ymylRiskLevel as any,
                              parsedWarnings: item.parsedWarnings,
                              status: item.status as any,
                            })
                          }
                        >
                          <Eye className="size-3" /> Diff Preview
                        </button>

                        {isApplied && (
                          <button
                            type="button"
                            className="btn btn-outline btn-error btn-xs gap-1"
                            disabled={revertingId === item.id}
                            onClick={() => handleRollback(item.id, item.title)}
                          >
                            {revertingId === item.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Undo / Rollback
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Diff Preview Modal */}
      {selectedItem && (
        <DiffPreviewModal
          data={selectedItem}
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          onApplied={() => {
            void queryClient.invalidateQueries({
              queryKey: ["siteChangeLog", projectId],
            });
          }}
        />
      )}
    </div>
  );
}

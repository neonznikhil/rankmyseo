import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Globe,
  Loader2,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { applySiteModification } from "@/serverFunctions/guardrails";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export interface DiffPreviewData {
  id: string;
  projectId: string;
  title: string;
  targetUrl: string;
  modificationType: string;
  beforePayload: string;
  afterPayload: string;
  diffPreview: string;
  ymylRiskLevel: "safe" | "caution" | "high_risk";
  parsedWarnings: string[];
  status: "preview" | "applied" | "reverted" | "failed";
}

interface DiffPreviewModalProps {
  data: DiffPreviewData;
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export function DiffPreviewModal({
  data,
  isOpen,
  onClose,
  onApplied,
}: DiffPreviewModalProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [confirmedYmyl, setConfirmedYmyl] = useState(false);

  if (!isOpen) return null;

  const isHighRisk = data.ymylRiskLevel === "high_risk";
  const isCaution = data.ymylRiskLevel === "caution";

  const handleApply = async () => {
    if (isHighRisk && !confirmedYmyl) {
      toast.error("Please acknowledge the YMYL / Legal risk disclaimer before applying.");
      return;
    }

    try {
      setIsApplying(true);
      await applySiteModification({
        data: {
          projectId: data.projectId,
          modificationId: data.id,
        },
      });
      toast.success("Change applied to live site. 28-day ROI tracking initiated!");
      onApplied?.();
      onClose();
    } catch (err) {
      toast.error(getStandardErrorMessage(err, "Failed to apply modification"));
    } finally {
      setIsApplying(false);
    }
  };

  const diffLines = data.diffPreview.split("\n");

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-4xl border border-base-300 bg-base-100 p-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <div className="flex items-center gap-2">
            <FileCode className="size-5 text-primary" />
            <div>
              <h3 className="font-bold text-base">{data.title}</h3>
              <div className="flex items-center gap-2 text-xs text-base-content/60">
                <Globe className="size-3.5" />
                <span className="truncate max-w-md">{data.targetUrl}</span>
                <span className="badge badge-sm badge-outline font-mono capitalize">
                  {data.modificationType.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* YMYL & Legal Risk Shield */}
          <div
            className={`rounded-xl border p-4 ${
              isHighRisk
                ? "border-error/40 bg-error/10 text-error-content"
                : isCaution
                  ? "border-warning/40 bg-warning/10 text-warning-content"
                  : "border-success/30 bg-success/10 text-success-content"
            }`}
          >
            <div className="flex items-start gap-3">
              {isHighRisk ? (
                <ShieldAlert className="size-6 text-error shrink-0 mt-0.5" />
              ) : isCaution ? (
                <AlertTriangle className="size-6 text-warning shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="size-6 text-success shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    YMYL & Legal Compliance Assessment:
                  </span>
                  <span
                    className={`badge badge-sm uppercase font-bold tracking-wider ${
                      isHighRisk
                        ? "badge-error"
                        : isCaution
                          ? "badge-warning"
                          : "badge-success text-white"
                    }`}
                  >
                    {data.ymylRiskLevel.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs opacity-90">
                  {isHighRisk
                    ? "Warning: Aggressive or unregulated claims detected. Changes in legal or health sectors can lead to Google Search quality downgrades or regulatory violations."
                    : isCaution
                      ? "Caution: Modifications contain sensitive keywords that may require formal disclaimers."
                      : "Verified: No severe YMYL compliance or misleading outcome guarantees detected."}
                </p>

                {data.parsedWarnings.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs font-medium">
                    {data.parsedWarnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Unified Diff Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-base-content/70">
              <span>Live Code Diff (Unified Preview)</span>
              <span className="text-[11px] font-mono text-base-content/50">
                Red: Current Live | Green: Proposed Patch
              </span>
            </div>
            <div className="rounded-lg border border-base-300 bg-base-300/40 p-3 font-mono text-xs overflow-x-auto select-text">
              {diffLines.map((line, index) => {
                const isAddition = line.startsWith("+") && !line.startsWith("+++");
                const isDeletion = line.startsWith("-") && !line.startsWith("---");
                const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");

                return (
                  <div
                    key={index}
                    className={`px-1.5 py-0.5 rounded whitespace-pre ${
                      isAddition
                        ? "bg-success/20 text-success font-semibold"
                        : isDeletion
                          ? "bg-error/20 text-error line-through"
                          : isHeader
                            ? "text-info font-bold bg-info/10"
                            : "text-base-content/80"
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </div>

          {/* High risk acknowledgement checkbox */}
          {isHighRisk && data.status !== "applied" && (
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-error/30 bg-error/5 p-3">
              <input
                type="checkbox"
                className="checkbox checkbox-error checkbox-sm"
                checked={confirmedYmyl}
                onChange={(e) => setConfirmedYmyl(e.target.checked)}
              />
              <span className="text-xs text-error font-medium">
                I have legally reviewed this content and authorize live deployment despite the flagged YMYL warnings.
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-base-300 p-4 bg-base-200/50">
          <div className="text-xs text-base-content/60 flex items-center gap-1.5">
            <Shield className="size-4 text-primary" />
            <span>Protected by RankMySEO Automatic Rollback Engine</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={isApplying}
            >
              Close
            </button>
            {data.status !== "applied" && (
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                onClick={handleApply}
                disabled={isApplying || (isHighRisk && !confirmedYmyl)}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Apply Live Change
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

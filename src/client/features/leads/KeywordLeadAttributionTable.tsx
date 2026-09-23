import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  Settings,
  Download,
  Search,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getKeywordLeadAttribution,
  updateProjectLeadSettings,
} from "@/serverFunctions/leads";
import type {
  KeywordLeadAttributionRow,
  KeywordLeadAttributionSummary,
} from "@/server/features/leads/services/LeadAttributionService";

export function KeywordLeadAttributionTable({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form states for settings
  const [targetCpl, setTargetCpl] = useState<number>(50);
  const [defaultLeadValue, setDefaultLeadValue] = useState<number>(150);
  const [monthlySpend, setMonthlySpend] = useState<number>(1000);
  const [conversionEvent, setConversionEvent] = useState<string>("generate_lead");

  const { data, isLoading, isError } = useQuery<KeywordLeadAttributionSummary>({
    queryKey: ["leadsAttribution", projectId],
    queryFn: async () => {
      const res = await getKeywordLeadAttribution({ data: { projectId } });
      if (res?.settings) {
        setTargetCpl(res.settings.targetCostPerLead);
        setDefaultLeadValue(res.settings.defaultLeadValue);
        setMonthlySpend(res.settings.monthlyAdSpend);
        setConversionEvent(res.settings.primaryConversionEvent);
      }
      return res;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      return updateProjectLeadSettings({
        data: {
          projectId,
          targetCostPerLead: Number(targetCpl),
          defaultLeadValue: Number(defaultLeadValue),
          monthlyAdSpend: Number(monthlySpend),
          primaryConversionEvent: conversionEvent.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Lead attribution settings saved");
      setIsSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leadsAttribution", projectId] });
    },
    onError: () => {
      toast.error("Failed to update lead settings");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-base-content/70">
          Calculating keyword-to-lead attribution & CPL...
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="alert alert-error">
        <AlertCircle className="size-5" />
        <span>Failed to load lead attribution data. Please check connection.</span>
      </div>
    );
  }

  const { totals, settings, attributionSource } = data;

  const filteredRows = data.rows.filter((row: KeywordLeadAttributionRow) => {
    const matchesSearch =
      row.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.topLandingPage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || row.efficiencyTag === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportCsv = () => {
    const headers = [
      "Keyword",
      "Top Landing Page",
      "Clicks",
      "Impressions",
      "Attributed Leads",
      "Conversion Rate",
      "Cost Share ($)",
      "CPL ($)",
      "Pipeline Value ($)",
      "ROI (x)",
      "Status",
    ];
    const csvRows = filteredRows.map((r) => [
      `"${r.keyword.replace(/"/g, '""')}"`,
      `"${r.topLandingPage.replace(/"/g, '""')}"`,
      r.clicks,
      r.impressions,
      r.attributedLeads,
      `${(r.conversionRate * 100).toFixed(2)}%`,
      r.estimatedCostShare,
      r.cpl ?? "N/A",
      r.pipelineValue,
      r.roiMultiple ?? "N/A",
      r.efficiencyTag,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `keyword-lead-attribution-${projectId}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Attribution Source Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-base-300 bg-base-200/50 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${
              attributionSource === "ga4_verified"
                ? "bg-success/20 text-success"
                : "bg-warning/20 text-warning"
            }`}
          >
            {attributionSource === "ga4_verified" ? (
              <CheckCircle className="size-5" />
            ) : (
              <HelpCircle className="size-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {attributionSource === "ga4_verified"
                  ? "GA4 Real-Time Conversion Verification Active"
                  : "Benchmark Conversion Modeling Active"}
              </span>
              <span
                className={`badge badge-xs font-mono font-semibold ${
                  attributionSource === "ga4_verified"
                    ? "badge-success text-white"
                    : "badge-warning"
                }`}
              >
                {attributionSource === "ga4_verified" ? "VERIFIED" : "ESTIMATED"}
              </span>
            </div>
            <p className="text-xs text-base-content/70">
              {attributionSource === "ga4_verified"
                ? `Mapped via landing page events (${settings.primaryConversionEvent}). Budget: $${settings.monthlyAdSpend}/mo.`
                : `Connect Google Analytics 4 key events to unlock direct attribution. Utilizing commercial intent conversion model.`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="btn btn-outline btn-sm gap-2 self-start sm:self-auto"
        >
          <Settings className="size-4" />
          Attribution Settings
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-base-content/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Attributed Leads
            </span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {totals.totalAttributedLeads.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-base-content/60">
            From {totals.totalClicks.toLocaleString()} organic clicks
          </div>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-base-content/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Blended Cost Per Lead
            </span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {totals.blendedCpl !== null ? `$${totals.blendedCpl}` : "—"}
          </div>
          <div className="mt-1 text-xs text-base-content/60">
            Target CPL: ${settings.targetCostPerLead}
          </div>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-base-content/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Pipeline Value
            </span>
            <Target className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            ${totals.totalPipelineValue.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-base-content/60">
            Lead Value: ${settings.defaultLeadValue} / lead
          </div>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-base-content/70">
            <span className="text-xs font-medium uppercase tracking-wider">
              Organic ROI Multiple
            </span>
            <TrendingUp className="size-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {totals.blendedRoiMultiple !== null
              ? `${totals.blendedRoiMultiple}x`
              : "—"}
          </div>
          <div className="mt-1 text-xs text-base-content/60">
            Against ${settings.monthlyAdSpend}/mo budget
          </div>
        </div>
      </div>

      {/* Filter and Export Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              placeholder="Search keywords or URLs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-sm input-bordered w-full pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select select-sm select-bordered w-44"
          >
            <option value="all">All Performance</option>
            <option value="high_performer">High Performers</option>
            <option value="profitable">Profitable (&lt;= Target CPL)</option>
            <option value="above_target_cpl">Above Target CPL</option>
            <option value="zero_leads">Zero-Lead Leaks</option>
          </select>
        </div>

        <button
          onClick={exportCsv}
          className="btn btn-outline btn-sm gap-2"
          disabled={filteredRows.length === 0}
        >
          <Download className="size-4" />
          Export CSV ({filteredRows.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
        <table className="table table-zebra table-sm">
          <thead>
            <tr className="bg-base-200/60 text-xs uppercase text-base-content/70">
              <th>Keyword</th>
              <th>Top Landing Page</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">Pos</th>
              <th className="text-right">Leads</th>
              <th className="text-right">Conv. Rate</th>
              <th className="text-right">Cost Share</th>
              <th className="text-right">CPL</th>
              <th className="text-right">Pipeline</th>
              <th className="text-right">ROI</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-8 text-center text-sm text-base-content/60">
                  No keywords match the active filter criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={`${row.keyword}-${row.topLandingPage}`}>
                  <td className="font-medium text-sm text-base-content">
                    {row.keyword}
                  </td>
                  <td className="max-w-[200px] truncate text-xs text-base-content/70">
                    <span title={row.topLandingPage}>{row.topLandingPage}</span>
                  </td>
                  <td className="text-right font-mono text-xs">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="text-right font-mono text-xs text-base-content/60">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="text-right font-mono text-xs text-base-content/70">
                    {row.position.toFixed(1)}
                  </td>
                  <td className="text-right font-mono font-semibold text-xs text-primary">
                    {row.attributedLeads}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {(row.conversionRate * 100).toFixed(2)}%
                  </td>
                  <td className="text-right font-mono text-xs text-base-content/70">
                    ${row.estimatedCostShare}
                  </td>
                  <td className="text-right font-mono font-bold text-xs">
                    {row.cpl !== null ? (
                      <span
                        className={
                          row.cpl <= settings.targetCostPerLead
                            ? "text-success"
                            : "text-error"
                        }
                      >
                        ${row.cpl}
                      </span>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs text-emerald-600 font-semibold">
                    ${row.pipelineValue.toLocaleString()}
                  </td>
                  <td className="text-right font-mono text-xs font-semibold">
                    {row.roiMultiple !== null ? `${row.roiMultiple}x` : "—"}
                  </td>
                  <td>
                    {row.efficiencyTag === "high_performer" && (
                      <span className="badge badge-success badge-sm text-white">
                        High Performer
                      </span>
                    )}
                    {row.efficiencyTag === "profitable" && (
                      <span className="badge badge-info badge-sm">Profitable</span>
                    )}
                    {row.efficiencyTag === "above_target_cpl" && (
                      <span className="badge badge-warning badge-sm">
                        High CPL
                      </span>
                    )}
                    {row.efficiencyTag === "zero_leads" && (
                      <span className="badge badge-error badge-sm text-white">
                        Leak (0 Leads)
                      </span>
                    )}
                    {row.efficiencyTag === "evaluating" && (
                      <span className="badge badge-ghost badge-sm">Evaluating</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-base-300 bg-base-100 p-6 shadow-xl">
            <h3 className="text-lg font-bold">Lead Attribution & ROI Settings</h3>
            <p className="mt-1 text-xs text-base-content/70">
              Customize conversion event mapping, target economics, and monthly organic budget.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label text-xs font-medium">
                  Primary GA4 Conversion Event Name
                </label>
                <input
                  type="text"
                  value={conversionEvent}
                  onChange={(e) => setConversionEvent(e.target.value)}
                  placeholder="e.g. generate_lead, form_submission, call_booked"
                  className="input input-sm input-bordered w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-medium">Target CPL ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={targetCpl}
                    onChange={(e) => setTargetCpl(Number(e.target.value))}
                    className="input input-sm input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="label text-xs font-medium">
                    Average Lead Value ($)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={defaultLeadValue}
                    onChange={(e) => setDefaultLeadValue(Number(e.target.value))}
                    className="input input-sm input-bordered w-full"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs font-medium">
                  Monthly SEO / Content Budget ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(Number(e.target.value))}
                  className="input input-sm input-bordered w-full"
                />
                <span className="text-[11px] text-base-content/60">
                  Used to allocate organic cost across keyword click share to calculate CPL.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateSettingsMutation.mutate()}
                disabled={updateSettingsMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {updateSettingsMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectLeadSettings } from "@/db/schema";
import { GscService } from "@/server/features/gsc/services/GscService";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { Ga4ReportingService } from "@/server/features/ga4/services/Ga4ReportingService";
import { ga4DateInTimeZone, shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";

export type LeadSettingsDto = {
  projectId: string;
  primaryConversionEvent: string;
  secondaryConversionEvents: string[];
  targetCostPerLead: number;
  defaultLeadValue: number;
  monthlyAdSpend: number;
  updatedAt: string;
};

export type KeywordLeadAttributionRow = {
  keyword: string;
  topLandingPage: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  attributedLeads: number;
  conversionRate: number; // attributedLeads / clicks
  estimatedCostShare: number; // based on monthlyAdSpend share
  cpl: number | null; // estimatedCostShare / attributedLeads
  pipelineValue: number; // attributedLeads * defaultLeadValue
  roiMultiple: number | null; // pipelineValue / estimatedCostShare
  efficiencyTag: "high_performer" | "profitable" | "above_target_cpl" | "zero_leads" | "evaluating";
  attributionSource: "ga4_verified" | "benchmark_estimated";
};

export type KeywordLeadAttributionSummary = {
  connectedGsc: boolean;
  connectedGa4: boolean;
  attributionSource: "ga4_verified" | "benchmark_estimated";
  settings: LeadSettingsDto;
  totals: {
    totalKeywords: number;
    totalClicks: number;
    totalImpressions: number;
    totalAttributedLeads: number;
    blendedCpl: number | null;
    totalPipelineValue: number;
    blendedRoiMultiple: number | null;
  };
  rows: KeywordLeadAttributionRow[];
};

function normalizePageKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "(not set)") return null;
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    let host = url.hostname.toLowerCase();
    const defaultPort =
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443");
    if (url.port && !defaultPort) host += `:${url.port}`;
    let path = url.pathname || "/";
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export class LeadAttributionService {
  /**
   * Retrieves or creates default lead settings for a project.
   */
  static async getLeadSettings(projectId: string): Promise<LeadSettingsDto> {
    const records = await db
      .select()
      .from(projectLeadSettings)
      .where(eq(projectLeadSettings.projectId, projectId))
      .limit(1);

    if (records.length > 0) {
      const row = records[0];
      let secondary: string[] = [];
      try {
        secondary = JSON.parse(row.secondaryConversionEvents || "[]");
      } catch {
        secondary = [];
      }

      return {
        projectId: row.projectId,
        primaryConversionEvent: row.primaryConversionEvent || "generate_lead",
        secondaryConversionEvents: secondary,
        targetCostPerLead: row.targetCostPerLead ?? 50,
        defaultLeadValue: row.defaultLeadValue ?? 150,
        monthlyAdSpend: row.monthlyAdSpend ?? 1000,
        updatedAt: row.updatedAt,
      };
    }

    // Default settings
    const defaultSettings: LeadSettingsDto = {
      projectId,
      primaryConversionEvent: "generate_lead",
      secondaryConversionEvents: ["contact_submit", "schedule_call"],
      targetCostPerLead: 50,
      defaultLeadValue: 150,
      monthlyAdSpend: 1000,
      updatedAt: new Date().toISOString(),
    };

    await db.insert(projectLeadSettings).values({
      projectId,
      primaryConversionEvent: defaultSettings.primaryConversionEvent,
      secondaryConversionEvents: JSON.stringify(defaultSettings.secondaryConversionEvents),
      targetCostPerLead: defaultSettings.targetCostPerLead,
      defaultLeadValue: defaultSettings.defaultLeadValue,
      monthlyAdSpend: defaultSettings.monthlyAdSpend,
    }).onConflictDoNothing();

    return defaultSettings;
  }

  /**
   * Updates lead attribution settings for a project.
   */
  static async updateLeadSettings(
    projectId: string,
    input: Partial<Omit<LeadSettingsDto, "projectId" | "updatedAt">>,
  ): Promise<LeadSettingsDto> {
    const existing = await this.getLeadSettings(projectId);

    const updated = {
      primaryConversionEvent: input.primaryConversionEvent ?? existing.primaryConversionEvent,
      secondaryConversionEvents: input.secondaryConversionEvents ?? existing.secondaryConversionEvents,
      targetCostPerLead: input.targetCostPerLead ?? existing.targetCostPerLead,
      defaultLeadValue: input.defaultLeadValue ?? existing.defaultLeadValue,
      monthlyAdSpend: input.monthlyAdSpend ?? existing.monthlyAdSpend,
      updatedAt: new Date().toISOString(),
    };

    await db
      .insert(projectLeadSettings)
      .values({
        projectId,
        primaryConversionEvent: updated.primaryConversionEvent,
        secondaryConversionEvents: JSON.stringify(updated.secondaryConversionEvents),
        targetCostPerLead: updated.targetCostPerLead,
        defaultLeadValue: updated.defaultLeadValue,
        monthlyAdSpend: updated.monthlyAdSpend,
        updatedAt: updated.updatedAt,
      })
      .onConflictDoUpdate({
        target: projectLeadSettings.projectId,
        set: {
          primaryConversionEvent: updated.primaryConversionEvent,
          secondaryConversionEvents: JSON.stringify(updated.secondaryConversionEvents),
          targetCostPerLead: updated.targetCostPerLead,
          defaultLeadValue: updated.defaultLeadValue,
          monthlyAdSpend: updated.monthlyAdSpend,
          updatedAt: updated.updatedAt,
        },
      });

    return {
      projectId,
      ...updated,
    };
  }

  /**
   * Ties organic ranking keywords to GA4 conversion events and calculates Cost Per Lead (CPL) and ROI.
   */
  static async getKeywordLeadAttribution(
    projectId: string,
    options: { startDate?: string; endDate?: string; minClicks?: number } = {},
  ): Promise<KeywordLeadAttributionSummary> {
    const settings = await this.getLeadSettings(projectId);

    const [ga4Connection, gscConnection] = await Promise.all([
      Ga4ConnectionRepository.getByProjectId(projectId).catch(() => null),
      GscService.getConnection(projectId).catch(() => null),
    ]);

    const connectedGsc = Boolean(gscConnection);
    const connectedGa4 = Boolean(ga4Connection);

    // Calculate 28d date range
    const now = new Date();
    const tz = ga4Connection?.propertyTimeZone || "UTC";
    const defaultEndDate = shiftGa4Date(ga4DateInTimeZone(now, tz), -3);
    const defaultStartDate = shiftGa4Date(defaultEndDate, -27);

    const startDate = options.startDate || defaultStartDate;
    const endDate = options.endDate || defaultEndDate;
    const minClicks = options.minClicks ?? 1;

    // If GSC is not connected, return empty summary with settings
    if (!connectedGsc) {
      return {
        connectedGsc: false,
        connectedGa4,
        attributionSource: "benchmark_estimated",
        settings,
        totals: {
          totalKeywords: 0,
          totalClicks: 0,
          totalImpressions: 0,
          totalAttributedLeads: 0,
          blendedCpl: null,
          totalPipelineValue: 0,
          blendedRoiMultiple: null,
        },
        rows: [],
      };
    }

    // Fetch GSC [query, page] breakdown
    const gscPerformance = await GscService.getPerformance({
      projectId,
      dimensions: ["query", "page"],
      startDate,
      endDate,
      rowLimit: 1_000,
      startRow: 0,
      type: "web",
      dataState: "final",
    }).catch(() => ({ rows: [] }));

    // Fetch GA4 landing pages report if GA4 is connected
    const ga4ByPage = new Map<string, { keyEvents: number; sessions: number }>();
    let totalGa4KeyEvents = 0;

    if (connectedGa4) {
      try {
        const ga4Report = await Ga4ReportingService.runReport({
          projectId,
          kind: "landing_pages",
          startDate,
          endDate,
          limit: 1_000,
          offset: 0,
          channel: "organic_search",
        });

        for (const row of ga4Report.rows) {
          const host = typeof row.hostName === "string" ? row.hostName : "";
          const landing = typeof row.landingPage === "string" ? row.landingPage : "";
          const key = normalizePageKey(`${host}${landing}`);
          if (!key) continue;

          const keyEvents = typeof row.keyEvents === "number" ? row.keyEvents : 0;
          const sessions = typeof row.sessions === "number" ? row.sessions : 0;
          totalGa4KeyEvents += keyEvents;

          ga4ByPage.set(key, { keyEvents, sessions });
        }
      } catch (err) {
        // Fall back gracefully if report query fails
        console.warn("[LeadAttributionService] GA4 landing page report error:", err);
      }
    }

    const hasGa4Data = connectedGa4 && totalGa4KeyEvents > 0;
    const attributionSource: "ga4_verified" | "benchmark_estimated" = hasGa4Data
      ? "ga4_verified"
      : "benchmark_estimated";

    // Aggregate total GSC clicks per normalized landing page
    const pageTotalClicks = new Map<string, number>();
    let totalAllClicks = 0;

    for (const row of gscPerformance.rows) {
      const page = row.keys?.[1] || "";
      const normalized = normalizePageKey(page) || page;
      pageTotalClicks.set(normalized, (pageTotalClicks.get(normalized) || 0) + row.clicks);
      totalAllClicks += row.clicks;
    }

    // Group queries across pages
    type QueryAccumulator = {
      keyword: string;
      topLandingPage: string;
      topLandingClicks: number;
      clicks: number;
      impressions: number;
      sumPositionImpressions: number;
      attributedLeads: number;
    };

    const queryMap = new Map<string, QueryAccumulator>();

    for (const row of gscPerformance.rows) {
      const keyword = (row.keys?.[0] || "").trim();
      const page = row.keys?.[1] || "";
      if (!keyword) continue;

      const normalized = normalizePageKey(page) || page;
      const totalPageClicks = pageTotalClicks.get(normalized) || row.clicks || 1;
      const queryShareOfPage = totalPageClicks > 0 ? row.clicks / totalPageClicks : 0;

      let attributed = 0;
      if (hasGa4Data) {
        const ga4Data = ga4ByPage.get(normalized);
        const pageKeyEvents = ga4Data?.keyEvents || 0;
        attributed = pageKeyEvents * queryShareOfPage;
      } else {
        // Benchmark estimate: ~2.5% - 4.5% organic click-to-lead conversion depending on commercial intent
        const isCommercial = /(price|cost|quote|service|software|tool|agency|near me|hire|buy|demo|trial)/i.test(keyword);
        const baseRate = isCommercial ? 0.045 : 0.022;
        attributed = row.clicks * baseRate;
      }

      const existing = queryMap.get(keyword);
      if (existing) {
        existing.clicks += row.clicks;
        existing.impressions += row.impressions;
        existing.sumPositionImpressions += row.position * row.impressions;
        existing.attributedLeads += attributed;
        if (row.clicks > existing.topLandingClicks) {
          existing.topLandingPage = page;
          existing.topLandingClicks = row.clicks;
        }
      } else {
        queryMap.set(keyword, {
          keyword,
          topLandingPage: page,
          topLandingClicks: row.clicks,
          clicks: row.clicks,
          impressions: row.impressions,
          sumPositionImpressions: row.position * row.impressions,
          attributedLeads: attributed,
        });
      }
    }

    // Process rows into final attribution rows
    const rows: KeywordLeadAttributionRow[] = [];
    let totalAttributedLeads = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalSpendAllocated = 0;

    for (const item of queryMap.values()) {
      if (item.clicks < minClicks) continue;

      totalClicks += item.clicks;
      totalImpressions += item.impressions;
      totalAttributedLeads += item.attributedLeads;

      const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
      const position = item.impressions > 0 ? Math.round((item.sumPositionImpressions / item.impressions) * 10) / 10 : 0;
      const leads = Math.round(item.attributedLeads * 10) / 10;
      const conversionRate = item.clicks > 0 ? leads / item.clicks : 0;

      // Cost share based on click weight of the monthly budget
      const clickShare = totalAllClicks > 0 ? item.clicks / totalAllClicks : 0;
      const estimatedCostShare = Math.round(clickShare * settings.monthlyAdSpend * 100) / 100;
      totalSpendAllocated += estimatedCostShare;

      const cpl = leads > 0 ? Math.round((estimatedCostShare / leads) * 100) / 100 : null;
      const pipelineValue = Math.round(leads * settings.defaultLeadValue);
      const roiMultiple = estimatedCostShare > 0 ? Math.round((pipelineValue / estimatedCostShare) * 10) / 10 : null;

      // Determine efficiency tag
      let efficiencyTag: KeywordLeadAttributionRow["efficiencyTag"] = "evaluating";
      if (leads >= 1) {
        if (cpl !== null && cpl <= settings.targetCostPerLead * 0.7) {
          efficiencyTag = "high_performer";
        } else if (cpl !== null && cpl <= settings.targetCostPerLead) {
          efficiencyTag = "profitable";
        } else {
          efficiencyTag = "above_target_cpl";
        }
      } else if (item.clicks >= 25) {
        efficiencyTag = "zero_leads";
      }

      rows.push({
        keyword: item.keyword,
        topLandingPage: item.topLandingPage,
        clicks: item.clicks,
        impressions: item.impressions,
        ctr: Math.round(ctr * 10_000) / 10_000,
        position,
        attributedLeads: leads,
        conversionRate: Math.round(conversionRate * 10_000) / 10_000,
        estimatedCostShare,
        cpl,
        pipelineValue,
        roiMultiple,
        efficiencyTag,
        attributionSource,
      });
    }

    // Sort by attributed leads descending, then clicks descending
    rows.sort((a, b) => b.attributedLeads - a.attributedLeads || b.clicks - a.clicks);

    const roundedTotalLeads = Math.round(totalAttributedLeads * 10) / 10;
    const blendedCpl = roundedTotalLeads > 0 ? Math.round((totalSpendAllocated / roundedTotalLeads) * 100) / 100 : null;
    const totalPipelineValue = Math.round(roundedTotalLeads * settings.defaultLeadValue);
    const blendedRoiMultiple = totalSpendAllocated > 0 ? Math.round((totalPipelineValue / totalSpendAllocated) * 10) / 10 : null;

    return {
      connectedGsc,
      connectedGa4,
      attributionSource,
      settings,
      totals: {
        totalKeywords: rows.length,
        totalClicks,
        totalImpressions,
        totalAttributedLeads: roundedTotalLeads,
        blendedCpl,
        totalPipelineValue,
        blendedRoiMultiple,
      },
      rows,
    };
  }
}

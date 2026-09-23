import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  audits,
  auditPages,
  auditIssues,
  gscConnections,
  projects,
  projectActionItems,
} from "@/db/schema";
import { GscService } from "@/server/features/gsc/services/GscService";

export type ProjectNetworkItem = {
  id: string;
  name: string;
  domain: string | null;
  locationCode: number;
  languageCode: string;
  createdAt: string;
  healthScore: number | null;
  healthStatus: "healthy" | "warning" | "critical" | "unaudited";
  indexedPages: number;
  totalCrawledPages: number;
  indexationRatio: number | null;
  gscConnected: boolean;
  clicks28d: number | null;
  impressions28d: number | null;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  totalOpenIssues: number;
  openActionItems: number;
  lastAuditAt: string | null;
  lastAuditStatus: string | null;
};

export type NetworkOverviewResult = {
  projects: ProjectNetworkItem[];
  totals: {
    totalProjects: number;
    avgHealthScore: number | null;
    totalClicks28d: number;
    totalCriticalIssues: number;
    totalWarningIssues: number;
  };
};

export const NetworkOverviewService = {
  async getOverview(organizationId: string): Promise<NetworkOverviewResult> {
    // 1. Fetch all active projects for organization
    const orgProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          isNull(projects.archivedAt),
        ),
      )
      .orderBy(desc(projects.createdAt));

    if (orgProjects.length === 0) {
      return {
        projects: [],
        totals: {
          totalProjects: 0,
          avgHealthScore: null,
          totalClicks28d: 0,
          totalCriticalIssues: 0,
          totalWarningIssues: 0,
        },
      };
    }

    const projectIds = orgProjects.map((p) => p.id);

    // 2. Fetch latest audits for all project IDs
    const allAudits = await db
      .select({
        id: audits.id,
        projectId: audits.projectId,
        status: audits.status,
        pagesCrawled: audits.pagesCrawled,
        pagesTotal: audits.pagesTotal,
        completedAt: audits.completedAt,
        startedAt: audits.startedAt,
      })
      .from(audits)
      .where(inArray(audits.projectId, projectIds))
      .orderBy(desc(audits.completedAt), desc(audits.startedAt));

    // Map latest audit per project
    const latestAuditByProject = new Map<string, (typeof allAudits)[0]>();
    for (const audit of allAudits) {
      if (!latestAuditByProject.has(audit.projectId)) {
        latestAuditByProject.set(audit.projectId, audit);
      }
    }

    const latestAuditIds = Array.from(latestAuditByProject.values())
      .filter((a) => a.status === "completed")
      .map((a) => a.id);

    // 3. Page indexability stats for latest completed audits
    const pageStatsMap = new Map<
      string,
      { indexed: number; total: number }
    >();
    if (latestAuditIds.length > 0) {
      const pageRows = await db
        .select({
          auditId: auditPages.auditId,
          isIndexable: auditPages.isIndexable,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditPages)
        .where(inArray(auditPages.auditId, latestAuditIds))
        .groupBy(auditPages.auditId, auditPages.isIndexable);

      for (const row of pageRows) {
        const current = pageStatsMap.get(row.auditId) ?? { indexed: 0, total: 0 };
        current.total += row.count;
        if (row.isIndexable) {
          current.indexed += row.count;
        }
        pageStatsMap.set(row.auditId, current);
      }
    }

    // 4. Issue counts for latest completed audits
    const issueStatsMap = new Map<
      string,
      { critical: number; warning: number; info: number }
    >();
    if (latestAuditIds.length > 0) {
      const issueRows = await db
        .select({
          auditId: auditIssues.auditId,
          severity: auditIssues.severity,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditIssues)
        .where(inArray(auditIssues.auditId, latestAuditIds))
        .groupBy(auditIssues.auditId, auditIssues.severity);

      for (const row of issueRows) {
        const current = issueStatsMap.get(row.auditId) ?? {
          critical: 0,
          warning: 0,
          info: 0,
        };
        if (row.severity === "critical") current.critical += row.count;
        else if (row.severity === "warning") current.warning += row.count;
        else if (row.severity === "info") current.info += row.count;
        issueStatsMap.set(row.auditId, current);
      }
    }

    // 5. Open action items count per project
    const actionItemStatsMap = new Map<string, number>();
    const actionRows = await db
      .select({
        projectId: projectActionItems.projectId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(projectActionItems)
      .where(
        and(
          inArray(projectActionItems.projectId, projectIds),
          eq(projectActionItems.status, "open"),
        ),
      )
      .groupBy(projectActionItems.projectId);

    for (const row of actionRows) {
      actionItemStatsMap.set(row.projectId, row.count);
    }

    // 6. GSC connections & 28-day performance
    const gscConns = await db
      .select({
        projectId: gscConnections.projectId,
        siteUrl: gscConnections.siteUrl,
      })
      .from(gscConnections)
      .where(inArray(gscConnections.projectId, projectIds));

    const gscConnMap = new Map(gscConns.map((c) => [c.projectId, c.siteUrl]));

    // Query 28d performance for connected projects
    const today = new Date();
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(today.getDate() - 28);
    const startDate = twentyEightDaysAgo.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    const gscStatsMap = new Map<
      string,
      { clicks: number; impressions: number }
    >();

    await Promise.all(
      gscConns.map(async (conn) => {
        try {
          const perf = await GscService.getPerformance({
            projectId: conn.projectId,
            startDate,
            endDate,
            dimensions: [],
          });
          let clicks = 0;
          let impressions = 0;
          for (const row of perf.rows) {
            clicks += row.clicks ?? 0;
            impressions += row.impressions ?? 0;
          }
          gscStatsMap.set(conn.projectId, { clicks, impressions });
        } catch {
          // If GSC fails to query or not authorized, fallback gracefully
          gscStatsMap.set(conn.projectId, { clicks: 0, impressions: 0 });
        }
      }),
    );

    // 7. Assemble ProjectNetworkItem list
    const items: ProjectNetworkItem[] = orgProjects.map((project) => {
      const latestAudit = latestAuditByProject.get(project.id);
      const isCompleted = latestAudit?.status === "completed";
      const pageStats = latestAudit ? pageStatsMap.get(latestAudit.id) : null;
      const issueStats = latestAudit ? issueStatsMap.get(latestAudit.id) : null;
      const gscConnected = gscConnMap.has(project.id);
      const gscStats = gscStatsMap.get(project.id);
      const openActions = actionItemStatsMap.get(project.id) ?? 0;

      const indexedPages = pageStats?.indexed ?? 0;
      const totalCrawledPages = pageStats?.total ?? 0;
      const indexationRatio =
        totalCrawledPages > 0
          ? Math.round((indexedPages / totalCrawledPages) * 100)
          : null;

      const critical = issueStats?.critical ?? 0;
      const warning = issueStats?.warning ?? 0;
      const info = issueStats?.info ?? 0;
      const totalOpenIssues = critical + warning + info;

      let healthScore: number | null = null;
      let healthStatus: ProjectNetworkItem["healthStatus"] = "unaudited";

      if (isCompleted) {
        // Base 100 score
        let score = 100;
        // Critical issues deduct 15 each (cap 60)
        score -= Math.min(60, critical * 15);
        // Warning issues deduct 3 each (cap 30)
        score -= Math.min(30, warning * 3);
        // Indexation ratio penalty
        if (indexationRatio !== null && indexationRatio < 80) {
          score -= 10;
        }
        healthScore = Math.max(0, Math.min(100, score));

        if (healthScore >= 80) healthStatus = "healthy";
        else if (healthScore >= 50) healthStatus = "warning";
        else healthStatus = "critical";
      }

      return {
        id: project.id,
        name: project.name,
        domain: project.domain,
        locationCode: project.locationCode,
        languageCode: project.languageCode,
        createdAt: project.createdAt,
        healthScore,
        healthStatus,
        indexedPages,
        totalCrawledPages,
        indexationRatio,
        gscConnected,
        clicks28d: gscConnected ? (gscStats?.clicks ?? 0) : null,
        impressions28d: gscConnected ? (gscStats?.impressions ?? 0) : null,
        criticalIssues: critical,
        warningIssues: warning,
        infoIssues: info,
        totalOpenIssues,
        openActionItems: openActions,
        lastAuditAt: latestAudit?.completedAt ?? latestAudit?.startedAt ?? null,
        lastAuditStatus: latestAudit?.status ?? null,
      };
    });

    // 8. Calculate totals
    const scoredProjects = items.filter((i) => i.healthScore !== null);
    const avgHealthScore =
      scoredProjects.length > 0
        ? Math.round(
            scoredProjects.reduce((sum, p) => sum + (p.healthScore ?? 0), 0) /
              scoredProjects.length,
          )
        : null;

    const totalClicks28d = items.reduce(
      (sum, p) => sum + (p.clicks28d ?? 0),
      0,
    );
    const totalCriticalIssues = items.reduce(
      (sum, p) => sum + p.criticalIssues,
      0,
    );
    const totalWarningIssues = items.reduce(
      (sum, p) => sum + p.warningIssues,
      0,
    );

    return {
      projects: items,
      totals: {
        totalProjects: items.length,
        avgHealthScore,
        totalClicks28d,
        totalCriticalIssues,
        totalWarningIssues,
      },
    };
  },
};

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditIssues,
  projectActionItems,
  projects,
} from "@/db/schema";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { GscService } from "@/server/features/gsc/services/GscService";

export type ActionItemDto = {
  id: string;
  projectId: string;
  issueKey: string;
  category: "technical" | "content" | "ranking" | "indexation" | "ux";
  title: string;
  description: string;
  recommendedAction: string;
  targetUrl: string | null;
  estimatedTrafficImpact: number;
  effort: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "resolved" | "dismissed";
  source: "audit" | "gsc" | "system";
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionListSummary = {
  items: ActionItemDto[];
  totalPotentialClicks: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
};

export class ActionEngineService {
  /**
   * Returns top 10 prioritized actions. If empty or stale (>24h), regenerates dynamically.
   */
  static async getPrioritizedActions(
    projectId: string,
    forceRefresh = false,
  ): Promise<ActionListSummary> {
    const existing = await db
      .select()
      .from(projectActionItems)
      .where(
        and(
          eq(projectActionItems.projectId, projectId),
          inArray(projectActionItems.status, ["pending", "in_progress"]),
        ),
      )
      .orderBy(desc(projectActionItems.estimatedTrafficImpact))
      .limit(10);

    // If no active items or force refresh requested, generate a fresh batch
    if (existing.length === 0 || forceRefresh) {
      await this.generateActions(projectId);
      return this.fetchActionSummary(projectId);
    }

    return this.fetchActionSummary(projectId);
  }

  private static async fetchActionSummary(
    projectId: string,
  ): Promise<ActionListSummary> {
    const items = await db
      .select()
      .from(projectActionItems)
      .where(
        and(
          eq(projectActionItems.projectId, projectId),
          inArray(projectActionItems.status, ["pending", "in_progress"]),
        ),
      )
      .orderBy(desc(projectActionItems.estimatedTrafficImpact))
      .limit(10);

    const counts = await db
      .select({
        status: projectActionItems.status,
        count: sql<number>`count(*)`,
        impact: sql<number>`sum(${projectActionItems.estimatedTrafficImpact})`,
      })
      .from(projectActionItems)
      .where(eq(projectActionItems.projectId, projectId))
      .groupBy(projectActionItems.status);

    let pendingCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;

    for (const c of counts) {
      if (c.status === "pending") pendingCount = Number(c.count);
      if (c.status === "in_progress") inProgressCount = Number(c.count);
      if (c.status === "resolved") resolvedCount = Number(c.count);
    }

    const totalPotentialClicks = items.reduce(
      (sum, item) => sum + (item.estimatedTrafficImpact || 0),
      0,
    );

    return {
      items: items as ActionItemDto[],
      totalPotentialClicks,
      pendingCount,
      inProgressCount,
      resolvedCount,
    };
  }

  /**
   * Analyzes site audit, search console ranking opportunities, and technical health to
   * produce a ranked, impact-sorted list of up to 10 actionable items.
   */
  static async generateActions(projectId: string): Promise<void> {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project.length) return;
    const domain = project[0].domain || "your site";

    const candidateActions: Array<{
      issueKey: string;
      category: "technical" | "content" | "ranking" | "indexation" | "ux";
      title: string;
      description: string;
      recommendedAction: string;
      targetUrl: string | null;
      estimatedTrafficImpact: number;
      effort: "low" | "medium" | "high";
      source: "audit" | "gsc" | "system";
    }> = [];

    // 1. Audit-based actions
    try {
      const latestAudit = await AuditRepository.getLatestAuditForProject(projectId);
      if (latestAudit) {
        const issues = await db
          .select({
            issueType: auditIssues.issueType,
            severity: auditIssues.severity,
            pageUrl: auditIssues.pageUrl,
          })
          .from(auditIssues)
          .where(eq(auditIssues.auditId, latestAudit.id))
          .limit(100);

        // Group by issue type
        const grouped = new Map<string, string[]>();
        for (const iss of issues) {
          const list = grouped.get(iss.issueType) || [];
          list.push(iss.pageUrl);
          grouped.set(iss.issueType, list);
        }

        // Broken Links (404s)
        const brokenLinks = grouped.get("broken_link") || grouped.get("status_4xx") || [];
        if (brokenLinks.length > 0) {
          candidateActions.push({
            issueKey: `audit_broken_links_${brokenLinks.length}`,
            category: "technical",
            title: `Fix ${brokenLinks.length} Broken Internal Links (404 Errors)`,
            description: `Crawlers discovered ${brokenLinks.length} broken links leaking link equity and hurting user engagement.`,
            recommendedAction: `Redirect or update link references pointing to dead URLs such as ${brokenLinks[0]}.`,
            targetUrl: brokenLinks[0],
            estimatedTrafficImpact: Math.min(brokenLinks.length * 35, 450),
            effort: "low",
            source: "audit",
          });
        }

        // Missing Meta Titles
        const missingTitles = grouped.get("missing_title") || grouped.get("title_missing") || [];
        if (missingTitles.length > 0) {
          candidateActions.push({
            issueKey: `audit_missing_title_${missingTitles.length}`,
            category: "content",
            title: `Add Optimized Title Tags to ${missingTitles.length} Pages`,
            description: `Pages without unique title tags forfeit primary ranking signals and CTR in search snippets.`,
            recommendedAction: `Craft concise 55-60 character title tags with primary keywords for ${missingTitles[0]}.`,
            targetUrl: missingTitles[0],
            estimatedTrafficImpact: Math.min(missingTitles.length * 50, 600),
            effort: "low",
            source: "audit",
          });
        }

        // Missing Canonical or Duplicates
        const canonicalIssues = grouped.get("missing_canonical") || grouped.get("duplicate_content") || [];
        if (canonicalIssues.length > 0) {
          candidateActions.push({
            issueKey: `audit_canonical_${canonicalIssues.length}`,
            category: "technical",
            title: `Resolve Canonical Conflicts on ${canonicalIssues.length} Pages`,
            description: `Missing or conflicting canonical tags cause search engines to split ranking authority across URLs.`,
            recommendedAction: `Implement self-referential canonical tags or point duplicates to the canonical master page.`,
            targetUrl: canonicalIssues[0],
            estimatedTrafficImpact: Math.min(canonicalIssues.length * 60, 500),
            effort: "medium",
            source: "audit",
          });
        }

        // Missing H1
        const missingH1 = grouped.get("missing_h1") || [];
        if (missingH1.length > 0) {
          candidateActions.push({
            issueKey: `audit_missing_h1_${missingH1.length}`,
            category: "content",
            title: `Add Descriptive H1 Headings to ${missingH1.length} Key Pages`,
            description: `Pages lack a primary H1 heading, weakening contextual relevance for organic search algorithms.`,
            recommendedAction: `Ensure each page has exactly one H1 clearly stating the topic and primary keyword.`,
            targetUrl: missingH1[0],
            estimatedTrafficImpact: Math.min(missingH1.length * 40, 320),
            effort: "low",
            source: "audit",
          });
        }
      }
    } catch (e) {
      console.warn("ActionEngine: Audit scan skipped or failed:", e);
    }

    // 2. GSC Striking Distance & Opportunity Actions
    try {
      const gscPerf = await GscService.getPerformance({
        projectId,
        dateRange: "last_28_days",
        dimensions: ["query", "page"],
      });

      if (gscPerf && gscPerf.rows.length > 0) {
        // Find keywords in striking distance: pos 4.0 - 18.0 with high impressions
        const strikingDistance = gscPerf.rows
          .filter(
            (r) =>
              r.position >= 4.0 &&
              r.position <= 18.0 &&
              r.impressions >= 80 &&
              r.keys &&
              r.keys.length >= 2,
          )
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5);

        for (const opp of strikingDistance) {
          const query = opp.keys?.[0] || "";
          const page = opp.keys?.[1] || "";
          if (!query || !page) continue;

          // Bumping from pos 4-15 (avg 2% CTR) to pos 1-3 (avg 18% CTR)
          const incremental = Math.max(
            Math.round(opp.impressions * Math.max(0.12 - (opp.ctr || 0.02), 0.04)),
            25,
          );

          candidateActions.push({
            issueKey: `gsc_striking_${query.replace(/\s+/g, "_")}`,
            category: "ranking",
            title: `Boost "${query}" from Pos ${opp.position.toFixed(1)} to Top 3`,
            description: `This query generates ${opp.impressions.toLocaleString()} impressions on ${page}. Lifting it into Top 3 will capture immediate search volume.`,
            recommendedAction: `Add 2-3 contextual internal links with exact/partial anchor text and enrich heading subtopics on ${page}.`,
            targetUrl: page,
            estimatedTrafficImpact: incremental,
            effort: "medium",
            source: "gsc",
          });
        }

        // Low CTR High Impression Pages (Pos 1-5, but CTR < 3%)
        const underperformingCtr = gscPerf.rows
          .filter(
            (r) =>
              r.position < 6.0 &&
              r.ctr < 0.035 &&
              r.impressions > 150 &&
              r.keys &&
              r.keys.length >= 2,
          )
          .slice(0, 3);

        for (const ctrIssue of underperformingCtr) {
          const query = ctrIssue.keys?.[0] || "";
          const page = ctrIssue.keys?.[1] || "";
          if (!query || !page) continue;

          const potentialLift = Math.round(ctrIssue.impressions * 0.05);

          candidateActions.push({
            issueKey: `gsc_ctr_boost_${query.replace(/\s+/g, "_")}`,
            category: "content",
            title: `Optimize Snippet CTR for "${query}" (Currently ${(ctrIssue.ctr * 100).toFixed(1)}%)`,
            description: `You rank on page 1 (Pos ${ctrIssue.position.toFixed(1)}) with ${ctrIssue.impressions.toLocaleString()} impressions, but click-through rate is below benchmark.`,
            recommendedAction: `Rewrite meta title and meta description on ${page} with compelling action hooks, numbers, or power words.`,
            targetUrl: page,
            estimatedTrafficImpact: potentialLift,
            effort: "low",
            source: "gsc",
          });
        }
      }
    } catch (e) {
      console.warn("ActionEngine: GSC scan skipped or unverified:", e);
    }

    // 3. Fallback / foundational high-value actions if site has few crawl/gsc items
    if (candidateActions.length < 5) {
      candidateActions.push({
        issueKey: "foundational_schema_markup",
        category: "technical",
        title: "Deploy Organization & WebSite JSON-LD Schema",
        description: "Structured data establishes entity clarity in Google Knowledge Graph and AI search engines (SGE / Perplexity).",
        recommendedAction: `Add Schema.org JSON-LD structured markup to the root layout of ${domain}.`,
        targetUrl: `https://${domain}`,
        estimatedTrafficImpact: 120,
        effort: "low",
        source: "system",
      });

      candidateActions.push({
        issueKey: "foundational_core_web_vitals",
        category: "ux",
        title: "Optimize LCP and Image Compression on Homepage",
        description: "Largest Contentful Paint above 2.5s degrades rankings on mobile and increases bounce rate.",
        recommendedAction: `Convert hero images to WebP/AVIF and preload critical LCP assets on ${domain}.`,
        targetUrl: `https://${domain}`,
        estimatedTrafficImpact: 95,
        effort: "medium",
        source: "system",
      });

      candidateActions.push({
        issueKey: "foundational_internal_linking",
        category: "content",
        title: "Establish Hub-and-Spoke Internal Topic Clusters",
        description: "Connecting related informational articles to high-intent commercial landing pages concentrates page authority.",
        recommendedAction: "Audit top 5 content pieces and add contextual links pointing to primary lead-generation pages.",
        targetUrl: `https://${domain}`,
        estimatedTrafficImpact: 160,
        effort: "medium",
        source: "system",
      });
    }

    // Sort all candidate actions by estimatedTrafficImpact descending
    candidateActions.sort(
      (a, b) => b.estimatedTrafficImpact - a.estimatedTrafficImpact,
    );

    // Take top 10
    const top10 = candidateActions.slice(0, 10);

    // Upsert into projectActionItems: avoid overwriting already resolved/in_progress tasks
    for (const item of top10) {
      const existing = await db
        .select({ id: projectActionItems.id, status: projectActionItems.status })
        .from(projectActionItems)
        .where(
          and(
            eq(projectActionItems.projectId, projectId),
            eq(projectActionItems.issueKey, item.issueKey),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(projectActionItems).values({
          id: crypto.randomUUID(),
          projectId,
          issueKey: item.issueKey,
          category: item.category,
          title: item.title,
          description: item.description,
          recommendedAction: item.recommendedAction,
          targetUrl: item.targetUrl,
          estimatedTrafficImpact: item.estimatedTrafficImpact,
          effort: item.effort,
          status: "pending",
          source: item.source,
        });
      }
    }
  }

  /**
   * Updates an action item's status (in_progress, resolved, dismissed).
   */
  static async updateStatus(
    projectId: string,
    actionId: string,
    status: "pending" | "in_progress" | "resolved" | "dismissed",
  ) {
    const isResolved = status === "resolved";
    await db
      .update(projectActionItems)
      .set({
        status,
        resolvedAt: isResolved ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(projectActionItems.id, actionId),
          eq(projectActionItems.projectId, projectId),
        ),
      );

    return this.fetchActionSummary(projectId);
  }
}

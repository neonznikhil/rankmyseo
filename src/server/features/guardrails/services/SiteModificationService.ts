import { db } from "@/db";
import {
  siteModifications,
  trackedRemediations,
  projectActionItems,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import crypto from "node:crypto";

export type YmylRiskLevel = "safe" | "caution" | "high_risk";

export interface YmylScanResult {
  riskLevel: YmylRiskLevel;
  warnings: string[];
}

export interface CreateModificationInput {
  projectId: string;
  actionItemId?: string;
  targetUrl: string;
  modificationType:
    | "title_tag"
    | "meta_description"
    | "canonical_url"
    | "heading_fix"
    | "content_patch"
    | "robots_meta";
  title: string;
  description?: string;
  beforePayload: string;
  afterPayload: string;
  appliedByUserId?: string;
}

export class SiteModificationService {
  /**
   * Generates a unified diff preview representation
   */
  static generateDiffPreview(
    before: string,
    after: string,
    label: string = "modification",
  ): string {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");

    const diffLines: string[] = [
      `--- a/${label}`,
      `+++ b/${label}`,
      `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ];

    let i = 0;
    let j = 0;
    while (i < beforeLines.length || j < afterLines.length) {
      if (i < beforeLines.length && j < afterLines.length) {
        if (beforeLines[i] === afterLines[j]) {
          diffLines.push(`  ${beforeLines[i]}`);
          i++;
          j++;
        } else {
          diffLines.push(`- ${beforeLines[i]}`);
          diffLines.push(`+ ${afterLines[j]}`);
          i++;
          j++;
        }
      } else if (i < beforeLines.length) {
        diffLines.push(`- ${beforeLines[i]}`);
        i++;
      } else if (j < afterLines.length) {
        diffLines.push(`+ ${afterLines[j]}`);
        j++;
      }
    }

    return diffLines.join("\n");
  }

  /**
   * Scans content specifically for YMYL (Your Money Your Life) and Legal compliance risks.
   * Protects websites from aggressive SEO claims that violate Google Guidelines or FTC/regulatory rules.
   */
  static scanYmylRisks(
    targetUrl: string,
    beforeText: string,
    afterText: string,
  ): YmylScanResult {
    const warnings: string[] = [];
    const lowerAfter = afterText.toLowerCase();
    const lowerUrl = targetUrl.toLowerCase();

    // 1. Legal / Regulatory guarantees
    const legalRiskPatterns = [
      { pattern: /guaranteed\s+(settlement|compensation|win|payout)/i, msg: "Guaranteed legal compensation/settlement claim violates attorney ethics guidelines." },
      { pattern: /win\s+your\s+case\s+guaranteed/i, msg: "Guaranteed case outcome promise detected." },
      { pattern: /100%\s+success\s+rate/i, msg: "100% success rate claim requires verifiable factual substantiation in legal/financial sectors." },
      { pattern: /no\s+win\s+no\s+fee\s+guarantee/i, msg: "Promotional fee guarantees must include mandatory jurisdiction-specific disclosures." },
    ];

    for (const rule of legalRiskPatterns) {
      if (rule.pattern.test(afterText)) {
        warnings.push(rule.msg);
      }
    }

    // 2. Medical / Health promises
    const medicalRiskPatterns = [
      { pattern: /cure[s]?\s+(cancer|diabetes|alzheimer|depression|anxiety)/i, msg: "Claim of disease cure violates medical advertising policies and YMYL guidelines." },
      { pattern: /miracle\s+(cure|treatment|healing|remedy)/i, msg: "Sensationalist health claim ('miracle cure') severely penalizes search quality rating." },
      { pattern: /guaranteed\s+weight\s+loss/i, msg: "Guaranteed weight loss claims trigger FTC regulatory penalties." },
      { pattern: /proven\s+cure/i, msg: "Unsubstantiated clinical efficacy claims detected." },
    ];

    for (const rule of medicalRiskPatterns) {
      if (rule.pattern.test(afterText)) {
        warnings.push(rule.msg);
      }
    }

    // 3. Financial / Investment guarantees
    const financialRiskPatterns = [
      { pattern: /guaranteed\s+(returns|profit|wealth|yield|roi)/i, msg: "Guaranteed investment returns claim violates SEC/FINRA regulations and YMYL guidelines." },
      { pattern: /risk[\s-]free\s+(investment|crypto|trading|stock)/i, msg: "Claim of 'risk-free' financial product triggers severe search and regulatory scrutiny." },
      { pattern: /instant\s+(loan\s+approval|wealth|credit\s+fix)/i, msg: "Deceptive financial outcome promise ('instant approval/fix') detected." },
      { pattern: /eliminate\s+all\s+debt\s+guaranteed/i, msg: "Debt elimination guarantee triggers FTC scrutiny." },
    ];

    for (const rule of financialRiskPatterns) {
      if (rule.pattern.test(afterText)) {
        warnings.push(rule.msg);
      }
    }

    // 4. Critical missing disclaimers on finance/health URLs
    const isFinancialOrMedical =
      /invest|finance|crypto|loan|health|medical|law|attorney|injury/i.test(lowerUrl);
    if (isFinancialOrMedical) {
      const hasDisclaimer =
        /disclaimer|not\s+financial\s+advice|past\s+performance|attorney\s+advertising|consult\s+a\s+doctor/i.test(lowerAfter);
      if (!hasDisclaimer && (afterText.length > 300 || warnings.length > 0)) {
        warnings.push("High-risk YMYL page modification lacks required regulatory disclaimers in copy.");
      }
    }

    // Calculate risk level
    let riskLevel: YmylRiskLevel = "safe";
    if (warnings.length >= 2 || warnings.some((w) => w.includes("violates") || w.includes("Guaranteed"))) {
      riskLevel = "high_risk";
    } else if (warnings.length > 0) {
      riskLevel = "caution";
    }

    return { riskLevel, warnings };
  }

  /**
   * Creates a pending preview modification with unified diff and YMYL risk scan
   */
  static async createModificationPreview(input: CreateModificationInput) {
    const ymylResult = this.scanYmylRisks(
      input.targetUrl,
      input.beforePayload,
      input.afterPayload,
    );

    const diffPreview = this.generateDiffPreview(
      input.beforePayload,
      input.afterPayload,
      input.modificationType,
    );

    const id = crypto.randomUUID();
    const now = new Date();

    const [created] = await db
      .insert(siteModifications)
      .values({
        id,
        projectId: input.projectId,
        targetUrl: input.targetUrl,
        changeType: input.modificationType,
        status: "staged",
        title: input.title,
        description: input.description || null,
        beforePayload: input.beforePayload,
        afterPayload: input.afterPayload,
        diffPreview,
        isYmyl: ymylResult.riskLevel !== "safe",
        ymylCategory: JSON.stringify({
          riskLevel: ymylResult.riskLevel,
          warnings: ymylResult.warnings,
          actionItemId: input.actionItemId || null,
        }),
        appliedByUserId: input.appliedByUserId || null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .returning();

    return {
      ...created,
      modificationType: created.changeType,
      ymylRiskLevel: ymylResult.riskLevel,
      parsedWarnings: ymylResult.warnings,
    };
  }

  /**
   * Applies an approved modification to the live site and links it to 28-day ROI tracking
   */
  static async applyModification(modificationId: string, userId?: string) {
    const existing = await db
      .select()
      .from(siteModifications)
      .where(eq(siteModifications.id, modificationId))
      .get();

    if (!existing) {
      throw new Error(`Modification ${modificationId} not found.`);
    }

    const now = new Date();

    // 1. Update site modification status to applied
    const [updated] = await db
      .update(siteModifications)
      .set({
        status: "applied",
        appliedAt: now.toISOString(),
        revertedAt: null,
        appliedByUserId: userId || existing.appliedByUserId,
        updatedAt: now.toISOString(),
      })
      .where(eq(siteModifications.id, modificationId))
      .returning();

    // 2. Parse category to extract optional actionItemId
    let actionItemId: string | null = null;
    try {
      if (existing.ymylCategory) {
        const parsed = JSON.parse(existing.ymylCategory);
        actionItemId = parsed.actionItemId || null;
      }
    } catch {
      actionItemId = null;
    }

    if (actionItemId) {
      await db
        .update(projectActionItems)
        .set({
          status: "resolved",
          resolvedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .where(eq(projectActionItems.id, actionItemId));
    }

    // 3. Automatically link to 28-day lift tracking in trackedRemediations
    const existingRemediation = await db
      .select()
      .from(trackedRemediations)
      .where(eq(trackedRemediations.modificationId, modificationId))
      .get();

    if (!existingRemediation) {
      const completionTarget = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
      await db.insert(trackedRemediations).values({
        id: crypto.randomUUID(),
        projectId: existing.projectId,
        modificationId: existing.id,
        targetUrl: existing.targetUrl,
        actionDescription: `Fixed: ${existing.title} (${existing.changeType})`,
        appliedAt: now.toISOString(),
        trackingEndAt: completionTarget.toISOString(),
        preClicks28d: 0,
        postClicks28d: 0,
        prePositionAvg: null,
        postPositionAvg: null,
        status: "tracking",
        lastEvaluatedAt: now.toISOString(),
        createdAt: now.toISOString(),
      });
    }

    return updated;
  }

  /**
   * Immediately rolls back an applied modification, recording the reversal timestamp and reason
   */
  static async rollbackModification(modificationId: string, userId?: string) {
    const existing = await db
      .select()
      .from(siteModifications)
      .where(eq(siteModifications.id, modificationId))
      .get();

    if (!existing) {
      throw new Error(`Modification ${modificationId} not found.`);
    }

    if (existing.status !== "applied") {
      throw new Error(
        `Cannot rollback modification with status '${existing.status}'. Only 'applied' changes can be rolled back.`,
      );
    }

    const now = new Date();

    // Update site modification to reverted
    const [reverted] = await db
      .update(siteModifications)
      .set({
        status: "reverted",
        revertedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(siteModifications.id, modificationId))
      .returning();

    // Update linked trackedRemediation to halted
    await db
      .update(trackedRemediations)
      .set({
        status: "halted",
        lastEvaluatedAt: now.toISOString(),
      })
      .where(eq(trackedRemediations.modificationId, modificationId));

    // If an action item was resolved by this, reopen it for review
    let actionItemId: string | null = null;
    try {
      if (existing.ymylCategory) {
        const parsed = JSON.parse(existing.ymylCategory);
        actionItemId = parsed.actionItemId || null;
      }
    } catch {
      actionItemId = null;
    }

    if (actionItemId) {
      await db
        .update(projectActionItems)
        .set({
          status: "pending",
          resolvedAt: null,
          updatedAt: now.toISOString(),
        })
        .where(eq(projectActionItems.id, actionItemId));
    }

    return reverted;
  }

  /**
   * Retrieves change log history for a project
   */
  static async getChangeLog(projectId: string, limit: number = 50) {
    const list = await db
      .select()
      .from(siteModifications)
      .where(eq(siteModifications.projectId, projectId))
      .orderBy(desc(siteModifications.createdAt))
      .limit(limit);

    return list.map((item) => {
      let ymylRiskLevel: YmylRiskLevel = item.isYmyl ? "caution" : "safe";
      let parsedWarnings: string[] = [];

      try {
        if (item.ymylCategory) {
          const parsed = JSON.parse(item.ymylCategory);
          if (parsed.riskLevel) ymylRiskLevel = parsed.riskLevel;
          if (Array.isArray(parsed.warnings)) parsedWarnings = parsed.warnings;
        }
      } catch {
        parsedWarnings = [];
      }

      return {
        ...item,
        modificationType: item.changeType,
        ymylRiskLevel,
        parsedWarnings,
      };
    });
  }
}

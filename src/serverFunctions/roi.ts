import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { RoiTrackerService } from "@/server/features/roi/services/RoiTrackerService";

const getRoiSummarySchema = z.object({
  projectId: z.string().min(1),
});

const trackCustomFixSchema = z.object({
  projectId: z.string().min(1),
  targetUrl: z.string().url(),
  actionDescription: z.string().min(3),
  baselineClicks: z.number().optional(),
  baselineRank: z.number().optional(),
});

const refreshRemediationSchema = z.object({
  projectId: z.string().min(1),
  remediationId: z.string().min(1),
});

export const getRoiSummary = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getRoiSummarySchema)
  .handler(async ({ data }) => {
    return RoiTrackerService.getRoiSummary(data.projectId);
  });

export const trackCustomFix = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trackCustomFixSchema)
  .handler(async ({ data }) => {
    return RoiTrackerService.trackCustomRemediation(data.projectId, {
      targetUrl: data.targetUrl,
      actionDescription: data.actionDescription,
      baselineClicks: data.baselineClicks,
      baselineRank: data.baselineRank,
    });
  });

export const refreshRemediation = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(refreshRemediationSchema)
  .handler(async ({ data }) => {
    return RoiTrackerService.refreshRemediationMetrics(data.remediationId);
  });

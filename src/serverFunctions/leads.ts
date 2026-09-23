import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { LeadAttributionService } from "@/server/features/leads/services/LeadAttributionService";

const getLeadsSchema = z.object({
  projectId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minClicks: z.number().optional(),
});

const updateLeadSettingsSchema = z.object({
  projectId: z.string().min(1),
  primaryConversionEvent: z.string().optional(),
  secondaryConversionEvents: z.array(z.string()).optional(),
  targetCostPerLead: z.number().positive().optional(),
  defaultLeadValue: z.number().positive().optional(),
  monthlyAdSpend: z.number().nonnegative().optional(),
});

export const getKeywordLeadAttribution = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getLeadsSchema)
  .handler(async ({ data }) => {
    return LeadAttributionService.getKeywordLeadAttribution(data.projectId, {
      startDate: data.startDate,
      endDate: data.endDate,
      minClicks: data.minClicks,
    });
  });

export const getProjectLeadSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    return LeadAttributionService.getLeadSettings(data.projectId);
  });

export const updateProjectLeadSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateLeadSettingsSchema)
  .handler(async ({ data }) => {
    const { projectId, ...settings } = data;
    return LeadAttributionService.updateLeadSettings(projectId, settings);
  });

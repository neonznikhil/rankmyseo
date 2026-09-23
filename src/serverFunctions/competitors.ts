import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { CompetitorIntelligenceService } from "@/server/features/competitors/services/CompetitorIntelligenceService";

const getIntelligenceSchema = z.object({
  projectId: z.string().min(1),
});

const addCompetitorSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(3),
  name: z.string().optional(),
  notes: z.string().optional(),
});

const removeCompetitorSchema = z.object({
  projectId: z.string().min(1),
  competitorId: z.string().min(1),
});

export const getCompetitorIntelligence = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getIntelligenceSchema)
  .handler(async ({ data }) => {
    return CompetitorIntelligenceService.getCompetitorIntelligence(data.projectId);
  });

export const addCompetitorDomain = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addCompetitorSchema)
  .handler(async ({ data, context }) => {
    return CompetitorIntelligenceService.addCompetitor(
      data.projectId,
      data.domain,
      data.name,
      data.notes,
      context.userId,
    );
  });

export const removeCompetitorDomain = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removeCompetitorSchema)
  .handler(async ({ data }) => {
    return CompetitorIntelligenceService.removeCompetitor(data.projectId, data.competitorId);
  });

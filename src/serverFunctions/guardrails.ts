import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { SiteModificationService } from "@/server/features/guardrails/services/SiteModificationService";

const createPreviewSchema = z.object({
  projectId: z.string().min(1),
  actionItemId: z.string().optional(),
  targetUrl: z.string().url(),
  modificationType: z.enum([
    "title_tag",
    "meta_description",
    "canonical_url",
    "heading_fix",
    "content_patch",
    "robots_meta",
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  beforePayload: z.string(),
  afterPayload: z.string(),
});

const applyModificationSchema = z.object({
  projectId: z.string().min(1),
  modificationId: z.string().min(1),
});

const rollbackModificationSchema = z.object({
  projectId: z.string().min(1),
  modificationId: z.string().min(1),
});

const getChangeLogSchema = z.object({
  projectId: z.string().min(1),
  limit: z.number().int().positive().optional().default(50),
});

const scanYmylSchema = z.object({
  projectId: z.string().min(1),
  targetUrl: z.string(),
  beforeText: z.string(),
  afterText: z.string(),
});

export const createSiteModificationPreview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createPreviewSchema)
  .handler(async ({ data, context }) => {
    return SiteModificationService.createModificationPreview({
      ...data,
      appliedByUserId: context.userId,
    });
  });

export const applySiteModification = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(applyModificationSchema)
  .handler(async ({ data, context }) => {
    return SiteModificationService.applyModification(
      data.modificationId,
      context.userId,
    );
  });

export const rollbackSiteModification = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(rollbackModificationSchema)
  .handler(async ({ data, context }) => {
    return SiteModificationService.rollbackModification(
      data.modificationId,
      context.userId,
    );
  });

export const getSiteChangeLog = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getChangeLogSchema)
  .handler(async ({ data }) => {
    return SiteModificationService.getChangeLog(data.projectId, data.limit);
  });

export const scanYmylText = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(scanYmylSchema)
  .handler(async ({ data }) => {
    return SiteModificationService.scanYmylRisks(
      data.targetUrl,
      data.beforeText,
      data.afterText,
    );
  });

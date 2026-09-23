import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { ActionEngineService } from "@/server/features/actions/services/ActionEngineService";

const getActionsSchema = z.object({
  projectId: z.string().min(1),
  forceRefresh: z.boolean().optional(),
});

const updateActionSchema = z.object({
  projectId: z.string().min(1),
  actionId: z.string().min(1),
  status: z.enum(["pending", "in_progress", "resolved", "dismissed"]),
});

export const getPrioritizedActions = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getActionsSchema)
  .handler(async ({ data }) => {
    return ActionEngineService.getPrioritizedActions(
      data.projectId,
      data.forceRefresh ?? false,
    );
  });

export const updateActionItemStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateActionSchema)
  .handler(async ({ data }) => {
    return ActionEngineService.updateStatus(
      data.projectId,
      data.actionId,
      data.status,
    );
  });

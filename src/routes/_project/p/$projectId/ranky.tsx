import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RankyChat } from "@/client/features/ranky/RankyChat";

const samSearchSchema = z.object({
  // Active session id. Omitted until a session is selected/created.
  s: z.string().optional(),
});

export const Route = createFileRoute("/_project/p/$projectId/ranky")({
  validateSearch: samSearchSchema,
  component: SamRoute,
});

function SamRoute() {
  const { projectId } = Route.useParams();
  const { s } = Route.useSearch();
  return <RankyChat projectId={projectId} activeSessionId={s} />;
}

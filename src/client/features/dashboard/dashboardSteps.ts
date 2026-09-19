import { Bot, FolderPlus, Globe, Search, Users } from "lucide-react";
import type { DashboardActivation } from "@/server/features/dashboard/services/DashboardService";
import type { DashboardSetupStep } from "@/types/schemas/dashboard";

export const setupSteps: {
  id: DashboardSetupStep;
  label: string;
  detail: string;
  icon: typeof Globe;
}[] = [
  {
    id: "domain",
    label: "Add your site",
    detail: "Tell us which website and country this project covers.",
    icon: Globe,
  },
  {
    id: "project",
    label: "Juggling several sites?",
    detail: "Spin up another project — or hand your AI agent a list to set up.",
    icon: FolderPlus,
  },
  {
    id: "competitor",
    label: "Study a competitor",
    detail: "See which topics and links are winning for them.",
    icon: Search,
  },
  {
    id: "mcp",
    label: "Link your AI agent",
    detail: "Bring RANKMYSEO into Claude or whichever agent you use.",
    icon: Bot,
  },
  {
    id: "gsc",
    label: "Add Search Console",
    detail: "Pull your actual clicks and queries in.",
    icon: Search,
  },
  {
    id: "team",
    label: "Add a teammate",
    detail: "Share the load — or keep flying solo for now.",
    icon: Users,
  },
];

export function getStepStatus(
  activation: DashboardActivation,
  step: DashboardSetupStep,
): "done" | "skipped" | "todo" {
  const completed: Record<DashboardSetupStep, boolean> = {
    domain: activation.domain !== null,
    project: activation.hasMultipleProjects,
    competitor: activation.competitorClickedAt !== null,
    mcp:
      activation.mcp.authorizedAt !== null ||
      activation.mcp.firstToolCallAt !== null,
    gsc: activation.gsc.connected,
    team: activation.hasTeammate,
  };
  if (completed[step]) return "done";
  // Preserve previous MCP dismissals without treating them as authorization.
  if (
    activation.dismissedSteps.includes(step) ||
    (step === "mcp" && activation.mcp.cardDismissedAt !== null)
  )
    return "skipped";
  return "todo";
}

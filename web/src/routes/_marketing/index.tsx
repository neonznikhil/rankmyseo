import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";
import { buildPageSeo } from "@/lib/seo";

const homeTitle = "RANKMYSEO - Open Source SEO Platform";
const homeDescription =
  "RANKMYSEO is the open source alternative to Ahrefs and Semrush. Keyword research, backlinks, rank tracking, and site audits, billed by usage instead of a $100-plus monthly subscription. Self-host it free, or connect it to your AI agents over MCP.";

export const Route = createFileRoute("/_marketing/")({
  head: () => {
    const seo = buildPageSeo({
      title: homeTitle,
      description: homeDescription,
      path: "/",
      imageAlt: "RANKMYSEO keyword research dashboard preview",
    });

    return {
      ...seo,
      links: [...(seo.links ?? [])],
    };
  },
  component: LandingPage,
});

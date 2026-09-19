import type { CSSProperties } from "react";

/**
 * The single shared recharts palette. Every chart draws its series from the
 * Action Blue ramp; neutrals come from theme tokens so both themes stay
 * coherent. Red/green appear only where the data itself diverges
 * (new-vs-lost backlinks), never as decoration.
 */

export const chartAccent = "#0066cc";
export const chartAccentSoft = "#2997ff";
export const chartAccentDeep = "#00468f";
export const chartAccentMist = "#9ec5f5";
export const chartNeutral = "#6e6e73";
export const chartMuted = "#8e8e93";

/** Diverging semantics only (never decoration). */
export const chartSemanticGain = "#16a34a";
export const chartSemanticLoss = "#ef4444";

/** Grid hairlines resolve against the active theme's border token. */
export const chartGridStroke = "var(--color-base-300)";
/** Axis ticks resolve against the active theme. */
export const chartTickFill = "var(--trend-axis-color)";

/** Default-tooltip chrome shared by every chart without a custom tooltip. */
export const chartTooltipContentStyle: CSSProperties = {
  backgroundColor: "var(--trend-tooltip-bg)",
  border: "1px solid var(--trend-tooltip-border)",
  borderRadius: 10,
  boxShadow: "0 8px 24px var(--trend-tooltip-shadow)",
  color: "var(--color-base-content)",
  fontSize: 12,
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: "var(--color-base-content)",
  fontWeight: 600,
  marginBottom: 4,
};

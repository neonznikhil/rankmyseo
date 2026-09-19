/**
 * Container-start preflight for Docker self-hosting. Validates the environment
 * before migrations and the vite build so misconfiguration fails in seconds
 * with the exact fix. Run via: pnpm exec tsx scripts/selfhost-preflight.ts
 *
 * Exits non-zero on hard failures (invalid AUTH_MODE, missing auth config for
 * the selected mode). Warnings and info lines never block startup.
 */
import process from "node:process";
import {
  formatPreflightReport,
  runSelfhostPreflight,
} from "../src/lib/selfhost-preflight";
import { isTelemetryOptOutValue } from "../src/shared/selfhost-checks";
import { version } from "../package.json";

function telemetryDisabled(): boolean {
  if (!process.env.SELF_HOST_POSTHOG_KEY?.trim()) return true;
  return (
    isTelemetryOptOutValue(process.env.RANKMYSEO_TELEMETRY_DISABLED) ||
    isTelemetryOptOutValue(process.env.DO_NOT_TRACK)
  );
}

// Anonymous "an install failed preflight" beacon: failed check names only, a
// throwaway distinct id, no env values. Without this, installs that never
// finish booting are invisible — the regular heartbeat needs a working app.
async function sendPreflightFailedBeacon(failedChecks: string[]) {
  if (telemetryDisabled()) return;

  const key = process.env.SELF_HOST_POSTHOG_KEY?.trim();
  if (!key) return;
  const host =
    process.env.SELF_HOST_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        api_key: key,
        event: "self_host.preflight_failed",
        distinct_id: crypto.randomUUID(),
        properties: {
          failedChecks,
          version,
          $process_person_profile: false,
        },
      }),
    });
  } catch {
    // Telemetry must never affect startup.
  }
}

const result = runSelfhostPreflight(process.env);

console.log("--- RANKMYSEO self-host preflight ---");
console.log(formatPreflightReport(result));

if (result.failed) {
  await sendPreflightFailedBeacon(
    result.items
      .filter((item) => item.level === "fail")
      .map((item) => item.name),
  );
  process.exit(1);
}

import { Link } from "@tanstack/react-router";
import { ShieldAlert, Wrench } from "lucide-react";

export function RankySetupGate({
  errorMessage,
  isRefetching,
  onRetry,
}: {
  errorMessage: string | null;
  isRefetching: boolean;
  onRetry: () => void;
}) {
  return (
    <section>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 md:p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-warning/15 p-2.5 text-warning shrink-0">
            <Wrench className="size-5" />
          </div>
          <div className="max-w-3xl space-y-1.5">
            <h2 className="text-xl font-semibold">Switch on AI features</h2>
            <div className="text-sm text-base-content/68">
              RANKY, the AI agent inside RANKMYSEO, runs on OpenRouter. Create a
              key, add it as the <code>OPENROUTER_API_KEY</code> environment
              variable, restart RANKMYSEO, then confirm below.
            </div>
            <div className="text-xs text-base-content/50">
              Every deployment is covered step by step in the{" "}
              <Link
                className="underline underline-offset-2 hover:text-base-content/70"
                to="/help/openrouter-api-key"
              >
                OpenRouter API key setup guide
              </Link>
              .
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            onClick={onRetry}
            disabled={isRefetching}
          >
            {isRefetching ? "Checking…" : "Confirm key"}
          </button>
          <a
            className="btn"
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get an OpenRouter key
          </a>
        </div>

        {errorMessage ? (
          <div className="alert alert-warning">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

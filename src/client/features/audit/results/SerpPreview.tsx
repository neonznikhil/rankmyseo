import { useState } from "react";
import { Eye, Globe, X } from "lucide-react";
import { Modal } from "@/client/components/Modal";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import {
  extractHostname,
  extractPathname,
} from "@/client/features/audit/shared";
import type { PageRow } from "@/client/features/audit/results/AuditResultsTableFilterLogic";

const TITLE_WARN_AT = 60;
const DESCRIPTION_WARN_AT = 160;

function displayUrl(url: string): string {
  const host = extractHostname(url);
  const path = extractPathname(url);
  return path && path !== "/" ? `${host} › ${path.replace(/^\//, "")}` : host;
}

function metaTagsSnippet(title: string, metaDescription: string): string {
  const lines = [`<title>${title}</title>`];
  if (metaDescription) {
    lines.push(`<meta name="description" content="${metaDescription}" />`);
  }
  return lines.join("\n");
}

export function SerpPreviewButton({ page }: { page: PageRow }) {
  const [open, setOpen] = useState(false);
  const title = page.title?.trim() || page.url;
  const description = page.metaDescription?.trim() ?? "";
  const titleTooLong = (page.title?.trim() ?? "").length > TITLE_WARN_AT;
  const descriptionTooLong = description.length > DESCRIPTION_WARN_AT;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Preview Google snippet for ${page.url}`}
        title="Preview Google snippet"
        className="inline-flex size-7 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
      >
        <Eye className="size-3.5" />
      </button>
      {open ? (
        <Modal
          maxWidth="max-w-lg"
          onClose={() => setOpen(false)}
          labelledBy="serp-preview-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="serp-preview-heading" className="text-base font-semibold">
              Google snippet preview
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close preview"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center gap-2 text-xs text-base-content/70">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-base-200">
                <Globe className="size-3.5" />
              </span>
              <span className="truncate">{displayUrl(page.url)}</span>
            </div>
            <p className="mt-1 truncate text-lg leading-snug text-[#1a0dab] hover:underline dark:text-[#8ab4f8]">
              {title}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-base-content/70">
              {description || (
                <span className="italic">
                  No meta description — Google will pick text from the page.
                </span>
              )}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-base-content/60">
            <div className="flex gap-1.5">
              <dt>Title</dt>
              <dd
                className={`font-medium tabular-nums ${titleTooLong ? "text-warning" : ""}`}
              >
                {(page.title?.trim() ?? "").length}/{TITLE_WARN_AT}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Description</dt>
              <dd
                className={`font-medium tabular-nums ${descriptionTooLong ? "text-warning" : ""}`}
              >
                {description.length}/{DESCRIPTION_WARN_AT}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end">
            <CopyButton
              value={metaTagsSnippet(page.title?.trim() ?? "", description)}
              label="Copy meta tags"
              successMessage="Meta tags copied"
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}

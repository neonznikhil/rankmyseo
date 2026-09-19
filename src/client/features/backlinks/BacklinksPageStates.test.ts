import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BacklinksErrorState } from "./BacklinksPageStates";

describe("BacklinksErrorState", () => {
  it("renders a visible retry state", () => {
    const markup = renderToStaticMarkup(
      createElement(BacklinksErrorState, {
        errorMessage: "Backlinks data failed to load.",
        onRetry: vi.fn(),
      }),
    );

    expect(markup).toContain("Backlinks didn’t load");
    expect(markup).toContain("Backlinks data failed to load.");
    expect(markup).toContain("Retry");
  });
});

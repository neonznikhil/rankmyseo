import { describe, expect, it } from "vitest";
import {
  buildCannibalizationRows,
  buildStrikingDistanceRows,
  previousPeriod,
  sumSearchTotals,
  toDimensionRows,
} from "@/server/features/gsc/searchPerformanceReport";

describe("sumSearchTotals", () => {
  it("sums clicks/impressions and impression-weights position", () => {
    const totals = sumSearchTotals([
      { clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
      { clicks: 5, impressions: 300, ctr: 0.016, position: 10 },
    ]);
    expect(totals.clicks).toBe(15);
    expect(totals.impressions).toBe(400);
    expect(totals.ctr).toBeCloseTo(15 / 400);
    // (2*100 + 10*300) / 400 = 8
    expect(totals.position).toBeCloseTo(8);
  });

  it("returns zeros for no rows instead of NaN", () => {
    expect(sumSearchTotals([])).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });
});

describe("toDimensionRows", () => {
  it("keeps the first key and drops keyless rows", () => {
    const rows = toDimensionRows([
      {
        keys: ["magento agency"],
        clicks: 3,
        impressions: 40,
        ctr: 0.075,
        position: 6.2,
      },
      { clicks: 1, impressions: 5, ctr: 0.2, position: 1 },
    ]);
    expect(rows).toEqual([
      {
        key: "magento agency",
        clicks: 3,
        impressions: 40,
        ctr: 0.075,
        position: 6.2,
      },
    ]);
  });
});

const row = (query: string, position: number, impressions: number) => ({
  keys: [query, `https://example.com/${query}`],
  clicks: 1,
  impressions,
  ctr: 0.01,
  position,
});

// Same query can map to multiple pages; this lets a test set distinct pages.
const pageRow = (
  query: string,
  page: string,
  position: number,
  impressions: number,
) => ({ keys: [query, page], clicks: 1, impressions, ctr: 0.01, position });

describe("buildStrikingDistanceRows", () => {
  it("keeps only positions 5..20 and sorts by impressions desc", () => {
    const rows = buildStrikingDistanceRows([
      row("top-spot", 2, 900),
      row("close", 6.4, 100),
      row("closer", 11, 400),
      row("page-3", 24, 800),
    ]);
    expect(rows.map((r) => r.query)).toEqual(["closer", "close"]);
  });

  it("includes the boundary positions and respects the limit", () => {
    const rows = buildStrikingDistanceRows(
      [row("low-edge", 5, 10), row("high-edge", 20, 20)],
      1,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe("high-edge");
  });

  it("drops rows without both query and page keys", () => {
    const rows = buildStrikingDistanceRows([
      {
        keys: ["only-query"],
        clicks: 1,
        impressions: 50,
        ctr: 0.02,
        position: 8,
      },
    ]);
    expect(rows).toHaveLength(0);
  });

  it("drops a query whose top page already ranks above the band", () => {
    // rankmyseo: homepage ranks #2, a secondary page ranks #6. The site already
    // ranks near the top, so the query is not a striking-distance opportunity.
    const rows = buildStrikingDistanceRows([
      pageRow("rankmyseo", "https://x.com/home", 2, 900),
      pageRow("rankmyseo", "https://x.com/mcp", 6, 300),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("collapses a query to its best-ranking page when that page is in band", () => {
    const rows = buildStrikingDistanceRows([
      pageRow("kw", "https://x.com/a", 14, 100),
      pageRow("kw", "https://x.com/b", 8, 500),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].page).toBe("https://x.com/b");
    expect(rows[0].position).toBe(8);
  });
});

describe("previousPeriod", () => {
  it("returns the same-length window ending the day before the start", () => {
    expect(previousPeriod("2026-06-01", "2026-06-28")).toEqual({
      startDate: "2026-05-04",
      endDate: "2026-05-31",
    });
  });

  it("handles a single-day range", () => {
    expect(previousPeriod("2026-06-10", "2026-06-10")).toEqual({
      startDate: "2026-06-09",
      endDate: "2026-06-09",
    });
  });
});

const cannibalRow = (
  query: string,
  page: string,
  impressions: number,
  clicks = 1,
  position = 8,
) => ({ keys: [query, page], clicks, impressions, ctr: 0.01, position });

describe("buildCannibalizationRows", () => {
  it("excludes a single-URL query", () => {
    const rows = buildCannibalizationRows([
      cannibalRow("solo", "https://x.com/a", 500, 50),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("flags a 3-URL query with impressions-based topShare math", () => {
    const rows = buildCannibalizationRows([
      cannibalRow("shoes", "https://x.com/a", 100, 10, 6),
      cannibalRow("shoes", "https://x.com/b", 60, 90, 9),
      cannibalRow("shoes", "https://x.com/c", 40, 5, 12),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].urlCount).toBe(3);
    expect(rows[0].totalImpressions).toBe(200);
    expect(rows[0].topPage).toBe("https://x.com/a");
    expect(rows[0].topShare).toBeCloseTo(0.5);
    expect(rows[0].risk).toBe("high");
    // Pages sorted by impressions desc.
    expect(rows[0].urls.map((u) => u.page)).toEqual([
      "https://x.com/a",
      "https://x.com/b",
      "https://x.com/c",
    ]);
    expect(rows[0].bestPosition).toBe(6);
  });

  it("normalizes queries across casing and whitespace", () => {
    const rows = buildCannibalizationRows([
      cannibalRow(" Best Shoes ", "https://x.com/a", 100),
      cannibalRow("best  shoes", "https://x.com/b", 100),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].urlCount).toBe(2);
  });

  it("drops low-impression noise and keyless rows", () => {
    const rows = buildCannibalizationRows([
      cannibalRow("tiny", "https://x.com/a", 4),
      cannibalRow("tiny", "https://x.com/b", 5),
      {
        keys: ["only-query"],
        clicks: 1,
        impressions: 50,
        ctr: 0.02,
        position: 8,
      },
    ]);
    expect(rows).toHaveLength(0);
  });

  it("scores zero-click groups on impression split, not clicks", () => {
    const split = buildCannibalizationRows([
      cannibalRow("split", "https://x.com/a", 50, 0),
      cannibalRow("split", "https://x.com/b", 50, 0),
    ]);
    expect(split).toHaveLength(1);
    expect(split[0].risk).toBe("high");

    const dominated = buildCannibalizationRows([
      cannibalRow("owned", "https://x.com/a", 90, 0),
      cannibalRow("owned", "https://x.com/b", 10, 0),
    ]);
    expect(dominated).toHaveLength(1);
    expect(dominated[0].risk).toBe("low");
  });

  it("marks a dominant page (>=85% impression share) as low risk", () => {
    const rows = buildCannibalizationRows([
      cannibalRow("brand", "https://x.com/home", 900, 400, 2),
      cannibalRow("brand", "https://x.com/mcp", 100, 1, 6),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].topShare).toBeCloseTo(0.9);
    expect(rows[0].risk).toBe("low");
  });

  it("preserves the first-seen display casing", () => {
    const rows = buildCannibalizationRows([
      cannibalRow("Best Shoes", "https://x.com/a", 100),
      cannibalRow("best shoes", "https://x.com/b", 100),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe("Best Shoes");
  });
});

import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";

/**
 * Pure shaping helpers for the Search Performance page. Kept separate from the
 * server function so the aggregation and striking-distance rules are unit
 * testable without a GSC client.
 */

type SearchPerformanceTotals = {
  clicks: number;
  impressions: number;
  /** 0..1 (clicks / impressions). */
  ctr: number;
  /** Impression-weighted average position; 0 when there were no impressions. */
  position: number;
};

type SearchPerformanceDimensionRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type StrikingDistanceRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
};

type CannibalizationUrlRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type CannibalizationRow = {
  query: string;
  urls: CannibalizationUrlRow[];
  urlCount: number;
  totalClicks: number;
  totalImpressions: number;
  topPage: string;
  /** Top page impressions / group total impressions (0..1). */
  topShare: number;
  /** Best (lowest) average position across the group's pages. */
  bestPosition: number;
  risk: "high" | "medium" | "low";
};

// "Striking distance" = already ranking, not yet in the top spots: the queries
// where a content improvement most plausibly moves real traffic.
const STRIKING_DISTANCE_MIN_POSITION = 5;
const STRIKING_DISTANCE_MAX_POSITION = 20;
const STRIKING_DISTANCE_ROW_LIMIT = 100;

// "Cannibalization" = two or more of the site's own pages appear in Google
// results for the same query, splitting impressions between them. Risk is
// scored on impression share (not clicks): GSC queries with impressions but
// zero clicks are common, and a clicks-based share would auto-flag every
// zero-click query as "high". The impression split IS the signal.
const CANNIBALIZATION_MIN_IMPRESSIONS = 10;
const CANNIBALIZATION_ROW_LIMIT = 100;
const CANNIBALIZATION_HIGH_SHARE = 0.6;
const CANNIBALIZATION_MEDIUM_SHARE = 0.85;

export function sumSearchTotals(
  rows: GscSearchAnalyticsRow[],
): SearchPerformanceTotals {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

/** Flatten single-dimension rows (query or page) into a keyed table row. */
export function toDimensionRows(
  rows: GscSearchAnalyticsRow[],
): SearchPerformanceDimensionRow[] {
  const output: SearchPerformanceDimensionRow[] = [];
  for (const row of rows) {
    const key = row.keys?.[0];
    if (!key) continue;
    output.push({
      key,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }
  return output;
}

/** Reduce `["query","page"]` rows to one striking-distance row per query.
 *
 *  GSC returns a row per page that ranks for a query, so a query fans out across
 *  every page it appears on. A query only belongs in "striking distance" when
 *  the site's BEST-ranking page for it sits in the 5..20 band — if any page
 *  already ranks above position 5, the site effectively ranks near the top and
 *  improving a secondary page won't move traffic. So we collapse each query to
 *  its top page (lowest average position; ties broken by impressions) and keep
 *  it only when that top page is in band. Result is sorted by impressions. */
export function buildStrikingDistanceRows(
  rows: GscSearchAnalyticsRow[],
  limit: number = STRIKING_DISTANCE_ROW_LIMIT,
): StrikingDistanceRow[] {
  const topPageByQuery = new Map<string, StrikingDistanceRow>();
  for (const row of rows) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page) continue;

    const current = topPageByQuery.get(query);
    const isBetter =
      !current ||
      row.position < current.position ||
      (row.position === current.position &&
        row.impressions > current.impressions);
    if (!isBetter) continue;

    topPageByQuery.set(query, {
      query,
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    });
  }

  return sort(
    Array.from(topPageByQuery.values()).filter(
      (row) =>
        row.position >= STRIKING_DISTANCE_MIN_POSITION &&
        row.position <= STRIKING_DISTANCE_MAX_POSITION,
    ),
    (a, b) => b.impressions - a.impressions,
  ).slice(0, limit);
}

/** Reduce `["query","page"]` rows to one cannibalization row per query where
 *  two or more of the site's pages appear for the same query.
 *
 *  Queries are normalized (trim, lowercase, collapse whitespace) so " Best
 *  Shoes " and "best  shoes" group together; the display query keeps the
 *  first-seen original casing. Groups with fewer than two pages or fewer than
 *  CANNIBALIZATION_MIN_IMPRESSIONS total impressions are dropped as noise.
 *  Pages sort by impressions desc (ties broken by clicks desc). Risk scores
 *  the top page's impression share: below 0.6 is high (split traffic), below
 *  0.85 is medium, otherwise low (one page dominates). Result is sorted by
 *  total impressions desc. */
export function buildCannibalizationRows(
  rows: GscSearchAnalyticsRow[],
  limit: number = CANNIBALIZATION_ROW_LIMIT,
): CannibalizationRow[] {
  const displayByNormalized = new Map<string, string>();
  const urlsByNormalized = new Map<string, CannibalizationUrlRow[]>();
  for (const row of rows) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page) continue;

    const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) continue;
    if (!displayByNormalized.has(normalized)) {
      displayByNormalized.set(normalized, query);
    }

    const list = urlsByNormalized.get(normalized);
    const urlRow: CannibalizationUrlRow = {
      page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
    if (list) {
      list.push(urlRow);
    } else {
      urlsByNormalized.set(normalized, [urlRow]);
    }
  }

  const output: CannibalizationRow[] = [];
  for (const [normalized, urls] of urlsByNormalized) {
    if (urls.length < 2) continue;

    let totalClicks = 0;
    let totalImpressions = 0;
    let bestPosition = 0;
    for (const url of urls) {
      totalClicks += url.clicks;
      totalImpressions += url.impressions;
      if (bestPosition === 0 || url.position < bestPosition) {
        bestPosition = url.position;
      }
    }
    if (totalImpressions < CANNIBALIZATION_MIN_IMPRESSIONS) continue;

    const sortedUrls = sort(
      urls,
      (a, b) => b.impressions - a.impressions || b.clicks - a.clicks,
    );
    const topPage = sortedUrls[0].page;
    const topShare =
      totalImpressions > 0 ? sortedUrls[0].impressions / totalImpressions : 0;

    output.push({
      query: displayByNormalized.get(normalized) ?? normalized,
      urls: sortedUrls,
      urlCount: sortedUrls.length,
      totalClicks,
      totalImpressions,
      topPage,
      topShare,
      bestPosition,
      risk:
        topShare < CANNIBALIZATION_HIGH_SHARE
          ? "high"
          : topShare < CANNIBALIZATION_MEDIUM_SHARE
            ? "medium"
            : "low",
    });
  }

  return sort(output, (a, b) => b.totalImpressions - a.totalImpressions).slice(
    0,
    limit,
  );
}

/** The same-length period immediately before [startDate, endDate], for the
 *  totals comparison. Dates are YYYY-MM-DD in UTC. */
export function previousPeriod(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const lengthMs = Math.max(end - start, 0);
  const prevEnd = start - dayMs;
  const prevStart = prevEnd - lengthMs;
  return {
    startDate: formatUtcDate(prevStart),
    endDate: formatUtcDate(prevEnd),
  };
}

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

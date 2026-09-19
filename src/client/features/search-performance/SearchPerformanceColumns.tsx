import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { MutableRefObject } from "react";
import { makeSelectionColumn } from "@/client/components/table/AppDataTable";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import type { SelectionAnchor } from "@/client/components/table/tableSelection";
import type {
  getSearchPerformanceReport,
  getSearchPerformanceTable,
} from "@/serverFunctions/searchPerformance";

export type Report = Extract<
  Awaited<ReturnType<typeof getSearchPerformanceReport>>,
  { connected: true }
>;
export type SearchPerformanceTableRow = Extract<
  Awaited<ReturnType<typeof getSearchPerformanceTable>>,
  { connected: true }
>["rows"][number];
type DimensionRow = SearchPerformanceTableRow;
type StrikingRow = Report["strikingDistance"][number];
export type CannibalizationTableRow = Report["cannibalization"][number];

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormat.format(Math.round(value));
}

export function formatCtr(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPosition(value: number): string {
  return value.toFixed(1);
}

export function formatShare(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const rightAligned = {
  headerClassName: "text-right",
  cellClassName: "text-right tabular-nums",
} as const;

const dimensionHelper = createColumnHelper<DimensionRow>();

export function buildDimensionColumns(
  keyLabel: string,
): ColumnDef<DimensionRow>[] {
  return [
    dimensionHelper.accessor("key", {
      enableSorting: false,
      header: () => keyLabel,
      cell: ({ getValue }) => (
        <span className="block max-w-xl truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    dimensionHelper.accessor("clicks", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Clicks" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    dimensionHelper.accessor("impressions", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Impressions" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    dimensionHelper.accessor("ctr", {
      header: ({ column }) => (
        <SortableHeader column={column} label="CTR" align="right" />
      ),
      cell: ({ getValue }) => formatCtr(getValue()),
      meta: rightAligned,
    }),
    dimensionHelper.accessor("position", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Position" align="right" />
      ),
      cell: ({ getValue }) => formatPosition(getValue()),
      meta: rightAligned,
    }),
  ];
}

const strikingHelper = createColumnHelper<StrikingRow>();

export function buildStrikingColumns(
  anchorRef: MutableRefObject<SelectionAnchor | null>,
): ColumnDef<StrikingRow>[] {
  return [
    makeSelectionColumn<StrikingRow>(anchorRef),
    strikingHelper.accessor("query", {
      enableSorting: false,
      header: () => "Query",
      cell: ({ getValue }) => (
        <span className="block max-w-xs truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    strikingHelper.accessor("page", {
      enableSorting: false,
      header: () => "Page",
      // GSC page keys are canonical http(s) URLs of the verified property;
      // the scheme check is defense-in-depth before rendering an href.
      cell: ({ getValue }) =>
        /^https?:\/\//.test(getValue()) ? (
          <a
            href={getValue()}
            target="_blank"
            rel="noreferrer"
            className="link link-hover block max-w-sm truncate"
            title={getValue()}
          >
            {getValue()}
          </a>
        ) : (
          <span className="block max-w-sm truncate" title={getValue()}>
            {getValue()}
          </span>
        ),
    }),
    strikingHelper.accessor("impressions", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Impressions" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    strikingHelper.accessor("clicks", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Clicks" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    strikingHelper.accessor("position", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Position" align="right" />
      ),
      cell: ({ getValue }) => formatPosition(getValue()),
      meta: rightAligned,
    }),
  ];
}

const RISK_BADGE_CLASS: Record<CannibalizationTableRow["risk"], string> = {
  high: "badge badge-sm badge-error",
  medium: "badge badge-sm badge-warning",
  low: "badge badge-sm badge-success",
};

const cannibalizationHelper = createColumnHelper<CannibalizationTableRow>();

export function buildCannibalizationColumns(
  onView: (row: CannibalizationTableRow) => void,
): ColumnDef<CannibalizationTableRow>[] {
  return [
    cannibalizationHelper.accessor("query", {
      enableSorting: false,
      header: () => "Query",
      cell: ({ getValue }) => (
        <span className="block max-w-xs truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    cannibalizationHelper.accessor("urlCount", {
      header: ({ column }) => (
        <SortableHeader column={column} label="URLs" align="right" />
      ),
      cell: ({ row }) => (
        <button
          type="button"
          className="link link-hover"
          title="View competing pages"
          onClick={() => onView(row.original)}
        >
          {formatCount(row.original.urlCount)}
        </button>
      ),
      meta: rightAligned,
    }),
    cannibalizationHelper.accessor("topPage", {
      enableSorting: false,
      header: () => "Top page",
      // Same link pattern as the striking Page column: GSC page keys are
      // canonical http(s) URLs; the scheme check is defense-in-depth.
      cell: ({ getValue }) =>
        /^https?:\/\//.test(getValue()) ? (
          <a
            href={getValue()}
            target="_blank"
            rel="noreferrer"
            className="link link-hover block max-w-sm truncate"
            title={getValue()}
          >
            {getValue()}
          </a>
        ) : (
          <span className="block max-w-sm truncate" title={getValue()}>
            {getValue()}
          </span>
        ),
    }),
    cannibalizationHelper.accessor("totalImpressions", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Impr." align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    cannibalizationHelper.accessor("totalClicks", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Clicks" align="right" />
      ),
      cell: ({ getValue }) => formatCount(getValue()),
      meta: rightAligned,
    }),
    cannibalizationHelper.accessor("topShare", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Top share" align="right" />
      ),
      cell: ({ getValue }) => formatShare(getValue()),
      meta: rightAligned,
    }),
    cannibalizationHelper.accessor("bestPosition", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Best pos" align="right" />
      ),
      cell: ({ getValue }) => formatPosition(getValue()),
      meta: rightAligned,
    }),
    cannibalizationHelper.accessor("risk", {
      header: ({ column }) => (
        <SortableHeader column={column} label="Risk" align="right" />
      ),
      cell: ({ getValue }) => (
        <span className={RISK_BADGE_CLASS[getValue()]}>{getValue()}</span>
      ),
      meta: rightAligned,
    }),
  ];
}

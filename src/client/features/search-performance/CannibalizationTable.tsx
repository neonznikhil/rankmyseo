import { useMemo, useState } from "react";
import { Modal } from "@/client/components/Modal";
import {
  AppDataTable,
  useAppTable,
} from "@/client/components/table/AppDataTable";
import { TablePagination } from "@/client/components/table/TablePagination";
import {
  buildCannibalizationColumns,
  formatCount,
  formatPosition,
  formatShare,
  type CannibalizationTableRow,
  type Report,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { buildCsv, downloadCsv, type CsvValue } from "@/client/lib/csv";
import { exportTableToSheets } from "@/client/lib/exportToSheets";
import { captureClientEvent } from "@/client/lib/posthog";
import { SEARCH_PERFORMANCE_PAGE_SIZES } from "@/types/schemas/search-performance";
import type { ExportTarget } from "@/client/features/search-performance/SearchPerformanceParts";

type CannibalizationExportTable = {
  filename: string;
  headers: string[];
  rows: CsvValue[][];
};

function cannibalizationExportTable(
  report: Report,
): CannibalizationExportTable {
  const stamp = `${report.range.startDate}-to-${report.range.endDate}`;
  return {
    filename: `search-performance-cannibalization-${stamp}.csv`,
    headers: [
      "Query",
      "URLs",
      "Top page",
      "Impressions",
      "Clicks",
      "Top share",
      "Best position",
      "Risk",
    ],
    rows: report.cannibalization.map((row) => [
      row.query,
      row.urlCount,
      row.topPage,
      row.totalImpressions,
      row.totalClicks,
      row.topShare,
      row.bestPosition,
      row.risk,
    ]),
  };
}

function runExport(
  table: CannibalizationExportTable,
  target: ExportTarget,
): void {
  if (target === "csv") {
    downloadCsv(table.filename, buildCsv(table.headers, table.rows));
    captureClientEvent("data:export", {
      source_feature: "search_performance",
      result_count: table.rows.length,
    });
    return;
  }
  void exportTableToSheets({
    headers: table.headers,
    rows: table.rows,
    feature: "search_performance",
  });
}

export function exportCannibalization(
  report: Report,
  target: ExportTarget,
): void {
  runExport(cannibalizationExportTable(report), target);
}

export function CannibalizationTable({
  rows,
}: {
  rows: Report["cannibalization"];
}) {
  const [selected, setSelected] = useState<CannibalizationTableRow | null>(
    null,
  );
  const columns = useMemo(
    () => buildCannibalizationColumns((row) => setSelected(row)),
    [],
  );
  const table = useAppTable({
    data: rows,
    columns,
    withSorting: true,
    withPagination: true,
    getRowId: (row) => row.query,
    initialState: {
      sorting: [{ id: "totalImpressions", desc: true }],
      // All rows are already loaded; paginate client-side to keep the table
      // short. 50/page by default.
      pagination: { pageIndex: 0, pageSize: 50 },
    },
  });
  const pagination = table.getState().pagination;

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-base-content/60">
        No cannibalization detected in this period. These are queries where two
        or more of your pages appear in Google results.
      </p>
    );
  }

  return (
    <>
      <div className="p-4">
        <p className="mb-3 text-sm text-base-content/60">
          Queries where 2+ of your pages appear in Google results, splitting
          clicks between them. Open a row to see the competing pages.
        </p>
        <AppDataTable
          table={table}
          className="table table-zebra table-sm"
          wrapperClassName="overflow-x-auto"
        />
        <p className="mt-3 text-xs text-base-content/50">
          Covers up to 1,000 query&times;page rows, the same limit as Striking
          distance.
        </p>
      </div>
      <TablePagination
        page={pagination.pageIndex + 1}
        pageSize={pagination.pageSize}
        pageSizes={SEARCH_PERFORMANCE_PAGE_SIZES}
        totalCount={rows.length}
        hasNextPage={table.getCanNextPage()}
        isLoading={false}
        onPageChange={(nextPage) => table.setPageIndex(nextPage - 1)}
        onPageSizeChange={(nextSize) => table.setPageSize(nextSize)}
      />
      {selected ? (
        <Modal
          maxWidth="max-w-3xl"
          onClose={() => setSelected(null)}
          labelledBy="cannibalization-detail-title"
        >
          <div>
            <h3
              id="cannibalization-detail-title"
              className="text-lg font-semibold"
            >
              {selected.query}
            </h3>
            <p className="text-sm text-base-content/60 mt-1">
              {formatCount(selected.urlCount)} competing pages &middot;{" "}
              {formatCount(selected.totalImpressions)} impressions &middot;{" "}
              {formatCount(selected.totalClicks)} clicks &middot; top share{" "}
              {formatShare(selected.topShare)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="text-right">Impressions</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {selected.urls.map((url) => (
                  <tr key={url.page}>
                    <td>
                      {/^https?:\/\//.test(url.page) ? (
                        <a
                          href={url.page}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-hover block max-w-md truncate"
                          title={url.page}
                        >
                          {url.page}
                        </a>
                      ) : (
                        <span
                          className="block max-w-md truncate"
                          title={url.page}
                        >
                          {url.page}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCount(url.impressions)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCount(url.clicks)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatPosition(url.position)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn btn-ghost btn-sm self-center"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
        </Modal>
      ) : null}
    </>
  );
}

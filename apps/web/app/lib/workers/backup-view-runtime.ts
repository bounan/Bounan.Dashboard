import type { AnalyzerFilters, BackupRow, BackupSeverity, BackupTableDefinition } from "../types";
import type { BackupViewWorkerReadyState } from "./backup-view-contract";

const severityOrder: Record<BackupSeverity, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
};

export function getWorkerTableHealth(rows: BackupRow[]): BackupSeverity {
  if (rows.some((row) => row.status === "critical")) {
    return "critical";
  }

  if (rows.some((row) => row.status === "warning")) {
    return "warning";
  }

  return "healthy";
}

export function getWorkerTableCounts(rows: BackupRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] += 1;
      return acc;
    },
    {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
    },
  );
}

export function filterWorkerRows(rows: BackupRow[], filters: AnalyzerFilters): BackupRow[] {
  const query = filters.query.trim().toLowerCase();

  return rows
    .filter((row) => {
      if (filters.issuesOnly && !row.issues.some((issue) => !issue.fixed)) {
        return false;
      }

      if (filters.status !== "all" && row.status !== filters.status) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [row.id, row.entity, row.region, row.checksum].some((value) =>
        String(value).toLowerCase().includes(query),
      );
    })
    .sort((left, right) => {
      const direction = filters.sortDirection === "asc" ? 1 : -1;

      if (filters.sortBy === "capturedAt") {
        const leftTime = left.capturedAt ? new Date(left.capturedAt).getTime() : 0;
        const rightTime = right.capturedAt ? new Date(right.capturedAt).getTime() : 0;
        return (leftTime - rightTime) * direction;
      }

      if (filters.sortBy === "status") {
        return (severityOrder[left.status] - severityOrder[right.status]) * direction;
      }

      return left.entity.localeCompare(right.entity) * direction;
    });
}

export function computeBackupView(input: {
  table: BackupTableDefinition;
  filters: AnalyzerFilters;
  page: number;
  pageSize: number;
  viewKey: string;
}): BackupViewWorkerReadyState {
  const filteredRows = filterWorkerRows(input.table.rows, input.filters);
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / input.pageSize));
  const page = Math.min(Math.max(1, input.page), totalPages);
  const startIndex = (page - 1) * input.pageSize;
  const pageRows = filteredRows.slice(startIndex, startIndex + input.pageSize);
  return {
    ready: true,
    viewKey: input.viewKey,
    tableKey: input.table.key,
    health: getWorkerTableHealth(input.table.rows),
    counts: getWorkerTableCounts(input.table.rows),
    page,
    totalPages,
    totalRows,
    pageRows,
  };
}

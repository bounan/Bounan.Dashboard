import type {
  AnalyzerFilters,
  BackupRow,
  BackupSeverity,
  BackupTableDefinition,
  ErrorCurrentRecordSnapshot,
  UnavailableCurrentRecordSnapshot,
} from "./types";

const severityOrder: Record<BackupSeverity, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
};

export function getTableByKey(
  tables: BackupTableDefinition[],
  key: string | null | undefined,
): BackupTableDefinition {
  const match = tables.find((table) => table.key === key);

  if (match) {
    return match;
  }

  const fallback = tables[0];

  if (!fallback) {
    throw new Error("At least one backup table is required");
  }

  return fallback;
}

export function getTableHealth(table: BackupTableDefinition): BackupSeverity {
  if (table.rows.some((row) => row.status === "critical")) {
    return "critical";
  }

  if (table.rows.some((row) => row.status === "warning")) {
    return "warning";
  }

  return "healthy";
}

export function getTableCounts(table: BackupTableDefinition) {
  return table.rows.reduce(
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

export function filterRows(rows: BackupRow[], filters: AnalyzerFilters): BackupRow[] {
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
        value.toLowerCase().includes(query),
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

export function replaceRowCurrentRecord(
  tables: BackupTableDefinition[],
  tableKey: string,
  rowId: string,
  currentRecord: UnavailableCurrentRecordSnapshot | ErrorCurrentRecordSnapshot,
): BackupTableDefinition[] {
  return tables.map((table) => {
    if (table.key !== tableKey) {
      return table;
    }

    return {
      ...table,
      rows: table.rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          rowSourceState: "backup-only",
          liveRecord: null,
          currentRecord,
        };
      }),
    };
  });
}

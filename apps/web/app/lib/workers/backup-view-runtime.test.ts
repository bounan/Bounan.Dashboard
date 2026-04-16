import { describe, expect, it } from "vitest";
import { backupTables } from "../mock-data";
import type { AnalyzerFilters, BackupRow, BackupTableDefinition } from "../types";
import { computeBackupView } from "./backup-view-runtime";

function createLargeTable(rowCount: number): BackupTableDefinition {
  const baseTable = backupTables[0]!;
  const rows: BackupRow[] = Array.from({ length: rowCount }, (_, index) => {
    const template = baseTable.rows[index % baseTable.rows.length]!;
    return {
      ...template,
      id: `${template.id}-${index}`,
      entity: `${template.entity}-${index}`,
      checksum: `${template.checksum}-${index}`,
      lookupKey: { ...template.lookupKey, accountId: `acct-${index}` },
      lookupSource: { ...template.lookupSource, accountId: `acct-${index}` },
      sourceRecord: { ...template.sourceRecord, accountId: `acct-${index}` },
    };
  });

  return {
    ...baseTable,
    key: `${baseTable.key}-large`,
    label: `${baseTable.label} Large`,
    rowCount: rows.length,
    rows,
  };
}

const defaultFilters: AnalyzerFilters = {
  query: "",
  issuesOnly: false,
  status: "all",
  sortBy: "capturedAt",
  sortDirection: "desc",
};

describe("backup view runtime", () => {
  it("filters and paginates a large table within a reasonable budget", () => {
    const table = createLargeTable(20000);
    const startedAt = performance.now();
    const result = computeBackupView({
      table,
      filters: {
        ...defaultFilters,
        issuesOnly: true,
        status: "critical",
        query: "acct_",
      },
      page: 3,
      pageSize: 50,
      viewKey: "large-critical",
    });
    const durationMs = performance.now() - startedAt;

    expect(result.ready).toBe(true);
    expect(result.page).toBe(3);
    expect(result.totalRows).toBeGreaterThan(0);
    expect(result.pageRows).toHaveLength(50);
    expect(result.pageRows.every((row) => row.status === "critical")).toBe(true);
    expect(result.pageRows.every((row) => row.issues.some((issue) => !issue.fixed))).toBe(true);
    expect(durationMs).toBeLessThan(1500);
  });

  it("switches pages on a large table without changing total counts", () => {
    const table = createLargeTable(12000);
    const pageOne = computeBackupView({
      table,
      filters: defaultFilters,
      page: 1,
      pageSize: 100,
      viewKey: "page-1",
    });
    const pageTwo = computeBackupView({
      table,
      filters: defaultFilters,
      page: 2,
      pageSize: 100,
      viewKey: "page-2",
    });

    expect(pageOne.totalRows).toBe(12000);
    expect(pageTwo.totalRows).toBe(12000);
    expect(pageOne.pageRows[0]?.id).not.toBe(pageTwo.pageRows[0]?.id);
  });
});

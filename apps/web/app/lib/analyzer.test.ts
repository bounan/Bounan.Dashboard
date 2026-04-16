import { describe, expect, it } from "vitest";
import { filterRows, getTableCounts, getTableHealth, replaceRowCurrentRecord } from "./analyzer";
import { backupTables } from "./mock-data";
import type { BackupRow } from "./types";

describe("analyzer helpers", () => {
  it("reports table health based on the worst row", () => {
    expect(getTableHealth(backupTables[0]!)).toBe("critical");
  });

  it("filters to issue rows by default", () => {
    const rows = filterRows(backupTables[0]!.rows, {
      query: "",
      issuesOnly: true,
      status: "all",
      sortBy: "capturedAt",
      sortDirection: "desc",
    });

    expect(rows.every((row) => row.status !== "healthy")).toBe(true);
  });

  it("keeps rows with unresolved issues when issuesOnly is enabled", () => {
    const baseRow = backupTables[0]!.rows[0] as BackupRow;
    const healthyRow: BackupRow = {
      ...baseRow,
      id: "healthy-row",
      status: "healthy",
      structuralIssues: [],
      issues: [],
    };
    const fixedRow: BackupRow = {
      ...baseRow,
      id: "fixed-row",
      status: "critical",
      structuralIssues: [],
      issues: [
        {
          code: "FIXED_ONLY",
          ruleId: "fixed-only",
          scope: "entry",
          severity: "critical",
          message: "Already fixed",
          fixed: true,
        },
      ],
    };
    const openRow: BackupRow = {
      ...baseRow,
      id: "open-row",
      status: "critical",
      structuralIssues: [],
      issues: [
        {
          code: "OPEN_ISSUE",
          ruleId: "open-issue",
          scope: "entry",
          severity: "critical",
          message: "Still open",
          fixed: false,
        },
      ],
    };

    const rows = filterRows([healthyRow, fixedRow, openRow], {
      query: "",
      issuesOnly: true,
      status: "critical",
      sortBy: "capturedAt",
      sortDirection: "desc",
    });

    expect(rows.map((row) => row.id)).toEqual(["open-row"]);
  });

  it("replaces the current record on a row", () => {
    const source = backupTables[1]!;
    const target = source.rows.find((row) => row.status !== "healthy");
    expect(target).toBeTruthy();

    const updated = replaceRowCurrentRecord(backupTables, source.key, target!.id, {
      status: "error",
      summary: "Current record refresh failed.",
      fields: [
        { key: source.partitionKey, value: target!.id },
        { key: "status", value: "error" },
      ],
    });
    const repairedTable = updated.find((table) => table.key === source.key)!;
    const repairedRow = repairedTable.rows.find((row) => row.id === target!.id)!;
    const counts = getTableCounts(repairedTable);

    expect(repairedRow.currentRecord.status).toBe("error");
    expect(repairedRow.currentRecord.summary).toContain("failed");
    expect(counts.total).toBe(source.rows.length);
  });
});

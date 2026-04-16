"use client";

import type { AwsActionTarget } from "./types";

export async function resumeAwsActionAfterPasswordChallenge(input: {
  target: AwsActionTarget;
  onRefreshTable: (tableKey: string) => Promise<unknown>;
  onLoadEntryByKey: (tableKey: string, lookupValues: Record<string, string>) => Promise<unknown>;
  onRefetchRow: (
    target: { tableKey: string; rowId: string },
    mode: "backup" | "rules",
  ) => Promise<unknown>;
}) {
  if (input.target.mode === "table-refresh") {
    return input.onRefreshTable(input.target.tableKey);
  }

  if (input.target.mode === "entry-lookup") {
    return input.onLoadEntryByKey(input.target.tableKey, input.target.lookupValues);
  }

  return input.onRefetchRow(
    {
      tableKey: input.target.tableKey,
      rowId: input.target.rowId,
    },
    input.target.mode,
  );
}

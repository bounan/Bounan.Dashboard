"use client";

import { replaceRowCurrentRecord } from "../../../../lib/analyzer";
import { CognitoNewPasswordRequiredError, refetchBackupEntry } from "../../../../lib/aws-browser";
import { toUserMessage } from "../../../../lib/error-presenter";
import { revalidateTablesWithLiveRecord } from "../../../../lib/rule-runtime";
import type { BackupConfig, BackupTableDefinition } from "../../../../lib/types";
import type { RowRefetchActionResult } from "../action-results";

export async function executeRowRefetch(input: {
  config: BackupConfig;
  tables: BackupTableDefinition[];
  tableKey: string;
  rowId: string;
  mode: "backup" | "rules";
  onApplyTables: (tables: BackupTableDefinition[]) => void;
  onSetTables: (updater: (current: BackupTableDefinition[]) => BackupTableDefinition[]) => void;
  onPasswordChallenge: (session: string) => void;
  onSuccess: (nextTables: BackupTableDefinition[]) => void;
  onFailure: (details: string) => void;
  onBlocked: (reason: "row-missing" | "heuristic-row") => void;
}): Promise<RowRefetchActionResult> {
  const activeTable = input.tables.find((table) => table.key === input.tableKey);
  const selectedRow = activeTable?.rows.find((row) => row.id === input.rowId);

  if (!activeTable || !selectedRow) {
    input.onBlocked("row-missing");
    return {
      ok: false,
      challengeRequired: false,
      code: "row-missing",
    };
  }

  if (selectedRow.identityState !== "schema-backed") {
    input.onBlocked("heuristic-row");
    return { ok: false, challengeRequired: false, code: "heuristic-row" };
  }

  try {
    const item = await refetchBackupEntry({
      config: input.config,
      tableName: activeTable.key,
      key: selectedRow.lookupKey,
      lookupSource: selectedRow.lookupSource,
    });
    const currentRecord = {
      status: "live" as const,
      summary: "Current record loaded from DynamoDB using Cognito credentials.",
      fields: Object.entries(item).map(([key, value]) => ({
        key,
        value:
          typeof value === "string"
            ? value
            : typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : JSON.stringify(value),
      })),
    };
    const nextTables = revalidateTablesWithLiveRecord({
      tables: input.tables,
      tableKey: activeTable.key,
      rowId: selectedRow.id,
      liveRecord: item,
      currentRecord,
    });

    input.onApplyTables(nextTables);
    input.onSuccess(nextTables);
    return {
      ok: true,
      challengeRequired: false,
      code: "row-refetched",
      mode: input.mode,
    };
  } catch (error) {
    if (error instanceof CognitoNewPasswordRequiredError) {
      input.onPasswordChallenge(error.session);
      return {
        ok: false,
        challengeRequired: true,
        code: "password-required",
      };
    }

    const message = toUserMessage(error, {
      code: "aws-permission",
      message: "Failed to refetch the current row.",
    });
    input.onSetTables((current) =>
      replaceRowCurrentRecord(current, activeTable.key, selectedRow.id, {
        status: "error",
        summary: message,
        fields: Object.entries(selectedRow.lookupKey).map(([key, value]) => ({
          key,
          value: value === null ? "null" : String(value),
        })),
      }),
    );
    input.onFailure(message);
    return { ok: false, challengeRequired: false, code: "aws-failure", details: message };
  }
}

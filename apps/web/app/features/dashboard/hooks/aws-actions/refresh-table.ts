"use client";

import {
  buildRuleReadyTableFromRecords,
  buildRuleReadyTablesFromTables,
} from "../../../../lib/backup-normalizer";
import {
  CognitoNewPasswordRequiredError,
  refreshBackupTableFromDynamo,
} from "../../../../lib/aws-browser";
import { toUserMessage } from "../../../../lib/error-presenter";
import { applyValidationRules } from "../../../../lib/rules/engine";
import type { BackupConfig, BackupTableDefinition } from "../../../../lib/types";
import type { TableRefreshActionResult } from "../action-results";

export async function executeTableRefresh(input: {
  config: BackupConfig;
  tables: BackupTableDefinition[];
  tableKey: string;
  onProgress: (progress: {
    phase: "starting" | "scanning";
    loadedCount?: number;
    estimatedCount?: number | null;
    pageCount?: number;
  }) => void;
  onApplyTables: (tables: BackupTableDefinition[]) => void;
  onPasswordChallenge: (session: string) => void;
  onSuccess: (
    metadata: { loadedCount: number; pageCount: number },
    nextTables: BackupTableDefinition[],
  ) => void;
  onFailure: (details: string) => void;
}): Promise<TableRefreshActionResult> {
  const activeTable = input.tables.find((table) => table.key === input.tableKey);

  if (!activeTable) {
    return {
      ok: false,
      challengeRequired: false,
      code: "table-missing",
    };
  }

  input.onProgress({ phase: "starting" });

  try {
    const scan = await refreshBackupTableFromDynamo({
      config: input.config,
      tableName: input.tableKey,
      onProgress: ({ loadedCount, estimatedCount, pageCount }) => {
        input.onProgress({
          phase: "scanning",
          loadedCount,
          estimatedCount,
          pageCount,
        });
      },
    });

    const nextRuleReadyTables = input.tables.map((table) =>
      table.key === input.tableKey
        ? buildRuleReadyTableFromRecords({
            key: activeTable.key,
            label: activeTable.label,
            primaryKeys: scan.primaryKeys.length > 0 ? scan.primaryKeys : activeTable.primaryKeys,
            identitySource: "schema",
            sourcePath: activeTable.sourcePath,
            records: scan.records,
          })
        : buildRuleReadyTablesFromTables([table])[0]!,
    );
    const nextTables = applyValidationRules(nextRuleReadyTables);
    input.onApplyTables(nextTables);
    input.onSuccess({ loadedCount: scan.records.length, pageCount: scan.pageCount }, nextTables);
    return {
      ok: true,
      challengeRequired: false,
      code: "table-refreshed",
      loadedCount: scan.records.length,
      pageCount: scan.pageCount,
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
      message: "Failed to refresh the table from DynamoDB.",
    });
    input.onFailure(message);
    return {
      ok: false,
      challengeRequired: false,
      code: "aws-failure",
      details: message,
    };
  }
}

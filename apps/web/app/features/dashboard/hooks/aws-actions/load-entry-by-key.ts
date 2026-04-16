"use client";

import {
  buildRuleReadyTableFromRecords,
  buildRuleReadyTablesFromTables,
  createNormalizedBackupRow,
} from "../../../../lib/backup-normalizer";
import {
  CognitoNewPasswordRequiredError,
  fetchBackupEntryByKey,
} from "../../../../lib/aws-browser";
import { createLookupIdentityKey } from "../../../../lib/backup-domain";
import { toUserMessage } from "../../../../lib/error-presenter";
import { applyValidationRules } from "../../../../lib/rules/engine";
import type { BackupConfig, BackupTableDefinition } from "../../../../lib/types";
import type { EntryLookupActionResult } from "../action-results";

export async function executeEntryLookup(input: {
  config: BackupConfig;
  tables: BackupTableDefinition[];
  tableKey: string;
  lookupValues: Record<string, string>;
  onProgress: () => void;
  onApplyTables: (tables: BackupTableDefinition[]) => void;
  onPasswordChallenge: (session: string) => void;
  onSuccess: (nextTables: BackupTableDefinition[]) => void;
  onFailure: (details: string) => void;
}): Promise<EntryLookupActionResult> {
  const activeTable = input.tables.find((table) => table.key === input.tableKey);

  if (!activeTable) {
    return {
      ok: false,
      challengeRequired: false,
      code: "table-missing",
    };
  }

  input.onProgress();

  try {
    const loaded = await fetchBackupEntryByKey({
      config: input.config,
      tableName: input.tableKey,
      lookupValues: input.lookupValues,
    });
    const newIdentityKey = createLookupIdentityKey(
      loaded.primaryKeys,
      Object.fromEntries(
        loaded.primaryKeys.map((key) => [
          key,
          (loaded.record as Record<string, unknown>)[key] as string | number | boolean | null,
        ]),
      ),
    );
    const existingRecords = activeTable.rows
      .filter((row) => {
        if (!newIdentityKey) {
          return true;
        }

        const rowIdentityKey =
          row.rowIdentityKey ?? createLookupIdentityKey(activeTable.primaryKeys, row.lookupKey);
        return rowIdentityKey !== newIdentityKey;
      })
      .map((row) => row.sourceRecord);

    const nextRuleReadyTables = input.tables.map((table) =>
      table.key === input.tableKey
        ? buildRuleReadyTableFromRecords({
            key: activeTable.key,
            label: activeTable.label,
            primaryKeys:
              loaded.primaryKeys.length > 0 ? loaded.primaryKeys : activeTable.primaryKeys,
            identitySource: "schema",
            sourcePath: activeTable.sourcePath,
            records: [...existingRecords, loaded.record],
          })
        : buildRuleReadyTablesFromTables([table])[0]!,
    );
    const nextTables = applyValidationRules(nextRuleReadyTables).map((table) => {
      if (table.key !== input.tableKey) {
        return table;
      }

      const loadedRow = createNormalizedBackupRow({
        record: loaded.record,
        index: table.rows.length - 1,
        primaryKeys: loaded.primaryKeys,
        duplicateIds: new Set<string>(),
        identitySource: "schema",
      });
      const loadedRowIdentityKey = loadedRow.rowIdentityKey;

      return {
        ...table,
        rows: table.rows.map((row) => {
          if (
            !loadedRowIdentityKey ||
            row.identityState !== "schema-backed" ||
            row.rowIdentityKey !== loadedRowIdentityKey
          ) {
            return row;
          }

          return {
            ...row,
            rowSourceState: "live-enriched" as const,
            liveRecord: loaded.record,
            currentRecord: {
              status: "live" as const,
              summary:
                "Current record loaded directly from DynamoDB using manually entered key fields.",
              fields: Object.entries(loaded.record).map(([key, value]) => ({
                key,
                value:
                  typeof value === "string"
                    ? value
                    : typeof value === "number" || typeof value === "boolean"
                      ? String(value)
                      : JSON.stringify(value),
              })),
            },
          };
        }),
      };
    });

    input.onApplyTables(nextTables);
    input.onSuccess(nextTables);
    return {
      ok: true,
      challengeRequired: false,
      code: "entry-loaded",
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
      message: "Failed to load the entry from DynamoDB.",
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

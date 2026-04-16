"use client";

import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  createLookupIdentityKey,
  createLookupKeyFromPrimaryKeys,
  createStableIdentity,
} from "../backup-domain";
import type { BackupTableDefinition, HeuristicBackupRow, SchemaBackedBackupRow } from "../types";

const tableSchemaCache = new Map<string, string[]>();
const tableKeyFieldCache = new Map<string, Array<{ name: string; type: "S" | "N" | "B" }>>();

export async function getTableKeyNames(client: DynamoDBClient, tableName: string) {
  const cached = tableSchemaCache.get(tableName);

  if (cached) {
    return cached;
  }

  const response = await client.send(
    new DescribeTableCommand({
      TableName: tableName,
    }),
  );
  const keyNames = (response.Table?.KeySchema ?? [])
    .slice()
    .sort((left, right) => {
      if (left.KeyType === right.KeyType) {
        return 0;
      }

      return left.KeyType === "HASH" ? -1 : 1;
    })
    .map((item) => item.AttributeName)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  tableSchemaCache.set(tableName, keyNames);
  return keyNames;
}

export async function getTableKeyFields(client: DynamoDBClient, tableName: string) {
  const cached = tableKeyFieldCache.get(tableName);

  if (cached) {
    return cached;
  }

  const response = await client.send(
    new DescribeTableCommand({
      TableName: tableName,
    }),
  );
  const attributeTypeByName = new Map(
    (response.Table?.AttributeDefinitions ?? [])
      .filter(
        (item): item is { AttributeName: string; AttributeType: "S" | "N" | "B" } =>
          typeof item.AttributeName === "string" &&
          (item.AttributeType === "S" || item.AttributeType === "N" || item.AttributeType === "B"),
      )
      .map((item) => [item.AttributeName, item.AttributeType]),
  );
  const keyFields = (response.Table?.KeySchema ?? [])
    .slice()
    .sort((left, right) => {
      if (left.KeyType === right.KeyType) {
        return 0;
      }

      return left.KeyType === "HASH" ? -1 : 1;
    })
    .map((item) => {
      const name = item.AttributeName;
      const type = name ? attributeTypeByName.get(name) : undefined;

      return name && type ? { name, type } : null;
    })
    .filter((item): item is { name: string; type: "S" | "N" | "B" } => item !== null);

  tableKeyFieldCache.set(tableName, keyFields);
  return keyFields;
}

export function applyTableSchemaMetadata(
  tables: BackupTableDefinition[],
  schemaByTable: Map<string, string[]>,
) {
  return tables.map((table) => {
    const keyNames = schemaByTable.get(table.key);

    if (!keyNames || keyNames.length === 0) {
      return table;
    }

    const rows = table.rows.map((row) => {
      const lookupKey = createLookupKeyFromPrimaryKeys(keyNames, row.lookupSource);
      const rowIdentityKey = createLookupIdentityKey(keyNames, lookupKey);
      const stableIdentity = createStableIdentity(keyNames, row.lookupSource, null);

      if (!rowIdentityKey || !stableIdentity) {
        const nextRow: HeuristicBackupRow = {
          ...row,
          rowSourceState: "backup-only",
          liveRecord: null,
          currentRecord:
            row.currentRecord.status === "error"
              ? row.currentRecord
              : {
                  status: "unavailable",
                  summary: row.currentRecord.summary,
                  fields: row.currentRecord.fields,
                },
          rowIdentityKey: null,
          stableIdentity: null,
          identitySource: "heuristic" as const,
          identityState: "heuristic-only" as const,
          lookupKey,
        };
        return nextRow;
      }

      const nextRow: SchemaBackedBackupRow =
        row.rowSourceState === "live-enriched"
          ? {
              ...row,
              rowSourceState: "live-enriched",
              rowIdentityKey,
              stableIdentity,
              identitySource: "schema" as const,
              identityState: "schema-backed" as const,
              lookupKey,
            }
          : {
              ...row,
              rowSourceState: "backup-only",
              liveRecord: null,
              currentRecord:
                row.currentRecord.status === "error"
                  ? row.currentRecord
                  : {
                      status: "unavailable",
                      summary: row.currentRecord.summary,
                      fields: row.currentRecord.fields,
                    },
              rowIdentityKey,
              stableIdentity,
              identitySource: "schema" as const,
              identityState: "schema-backed" as const,
              lookupKey,
            };
      return nextRow;
    });

    return {
      ...table,
      partitionKey: keyNames[0] ?? table.partitionKey,
      primaryKeys: keyNames,
      identitySource: rows.every((row) => row.identityState === "schema-backed")
        ? ("schema" as const)
        : table.identitySource,
      identityState: rows.every((row) => row.identityState === "schema-backed")
        ? ("schema-backed" as const)
        : table.identityState,
      rows,
    };
  });
}

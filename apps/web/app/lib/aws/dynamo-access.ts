"use client";

import {
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  type ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AppError } from "../errors";
import type { BackupConfig, BackupTableDefinition } from "../types";
import { getIdToken } from "./cognito";
import { normalizeUnmarshalledDynamoRecord } from "./dynamo-normalization";
import { applyTableSchemaMetadata, getTableKeyFields, getTableKeyNames } from "./dynamo-schema";
import { requireValue, sendWithRetry } from "./shared";

export async function createDynamoClient(config: BackupConfig) {
  const region = requireValue(config.awsRegion, "AWS region");
  const identityPoolId = requireValue(config.cognitoIdentityPoolId, "Cognito Identity Pool ID");
  const auth = await getIdToken(config);

  return new DynamoDBClient({
    region,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region },
      identityPoolId,
      logins: {
        [auth.providerKey]: auth.idToken,
      },
    }),
  });
}

export async function enrichTablesWithDynamoSchema(input: {
  config: BackupConfig;
  tables: BackupTableDefinition[];
}) {
  const client = await createDynamoClient(input.config);
  const schemaByTable = new Map<string, string[]>();

  for (const table of input.tables) {
    const keyNames = await getTableKeyNames(client, table.key);

    if (keyNames.length > 0) {
      schemaByTable.set(table.key, keyNames);
    }
  }

  return applyTableSchemaMetadata(input.tables, schemaByTable);
}

function toAttributeValue(value: string | number | boolean | null) {
  if (typeof value === "number") {
    return { N: String(value) };
  }

  if (typeof value === "boolean") {
    return { BOOL: value };
  }

  return { S: String(value) };
}

function parseManualLookupValue(rawValue: string, type: "S" | "N" | "B") {
  const value = rawValue.trim();

  if (!value) {
    throw new AppError("aws-permission", "All key fields are required.");
  }

  if (type === "S") {
    return { S: value };
  }

  if (type === "N") {
    if (Number.isNaN(Number(value))) {
      throw new AppError("aws-permission", `Key value "${value}" must be numeric.`);
    }

    return { N: value };
  }

  throw new AppError(
    "aws-permission",
    "Binary DynamoDB key fields are not supported by the manual lookup UI.",
  );
}

export function resolveLookupKeyValues(input: {
  keyNames: string[];
  lookupSource: Record<string, string | number | boolean | null>;
  fallbackLookupKey: Record<string, string | number | boolean | null>;
}) {
  if (input.keyNames.length === 0) {
    throw new AppError("aws-permission", "DynamoDB key schema is unavailable for this table.");
  }

  const keyEntries = input.keyNames.map((keyName) => {
    const value = input.lookupSource[keyName] ?? input.fallbackLookupKey[keyName] ?? null;
    return [keyName, value] as const;
  });
  const missing = keyEntries.filter(([, value]) => value === null);

  if (missing.length > 0) {
    throw new AppError(
      "aws-permission",
      `This entry does not expose DynamoDB key fields: ${missing.map(([key]) => key).join(", ")}.`,
    );
  }

  return Object.fromEntries(keyEntries);
}

export function createLookupKeyFromSchema(input: {
  keyNames: string[];
  lookupSource: Record<string, string | number | boolean | null>;
  fallbackLookupKey: Record<string, string | number | boolean | null>;
}) {
  const values = resolveLookupKeyValues(input);
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, toAttributeValue(value)]),
  );
}

async function createLookupKey(input: {
  client: DynamoDBClient;
  tableName: string;
  lookupSource: Record<string, string | number | boolean | null>;
  fallbackLookupKey: Record<string, string | number | boolean | null>;
}) {
  const keyNames = await getTableKeyNames(input.client, input.tableName);

  return createLookupKeyFromSchema({
    keyNames,
    lookupSource: input.lookupSource,
    fallbackLookupKey: input.fallbackLookupKey,
  });
}

export async function validateAwsAccess(input: { config: BackupConfig; tableNames: string[] }) {
  const client = await createDynamoClient(input.config);

  if (input.tableNames.length === 0) {
    return {
      ok: true,
      checkedTableCount: 0,
    };
  }

  const failedTables: string[] = [];

  for (const tableName of input.tableNames) {
    try {
      await client.send(
        new DescribeTableCommand({
          TableName: tableName,
        }),
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : "DescribeTable failed";
      failedTables.push(`${tableName}: ${details}`);
    }
  }

  if (failedTables.length > 0) {
    throw new AppError("aws-permission", failedTables.join(" | "));
  }

  return {
    ok: true,
    checkedTableCount: input.tableNames.length,
  };
}

export async function refreshBackupTableFromDynamo(input: {
  config: BackupConfig;
  tableName: string;
  pageSize?: number;
  onProgress?: (progress: {
    loadedCount: number;
    estimatedCount: number | null;
    pageCount: number;
  }) => void;
}) {
  const client = await createDynamoClient(input.config);
  const keyNames = await getTableKeyNames(client, input.tableName);
  const describeResponse = await sendWithRetry(() =>
    client.send(
      new DescribeTableCommand({
        TableName: input.tableName,
      }),
    ),
  );
  const estimatedCount =
    typeof describeResponse.Table?.ItemCount === "number" ? describeResponse.Table.ItemCount : null;
  const records: Record<string, unknown>[] = [];
  const pageSize = input.pageSize ?? 100;
  let lastEvaluatedKey: ScanCommandOutput["LastEvaluatedKey"] | undefined;
  let pageCount = 0;

  do {
    const response = await sendWithRetry(() =>
      client.send(
        new ScanCommand({
          TableName: input.tableName,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: pageSize,
        }),
      ),
    );

    const pageRecords = (response.Items ?? []).map((item) =>
      normalizeUnmarshalledDynamoRecord(unmarshall(item)),
    );
    records.push(...pageRecords);
    lastEvaluatedKey = response.LastEvaluatedKey;
    pageCount += 1;
    input.onProgress?.({
      loadedCount: records.length,
      estimatedCount,
      pageCount,
    });
  } while (lastEvaluatedKey);

  return {
    records,
    primaryKeys: keyNames,
    estimatedCount,
    pageCount,
  };
}

export async function fetchBackupEntryByKey(input: {
  config: BackupConfig;
  tableName: string;
  lookupValues: Record<string, string>;
}) {
  const client = await createDynamoClient(input.config);
  const keyFields = await getTableKeyFields(client, input.tableName);

  if (keyFields.length === 0) {
    throw new AppError("aws-permission", "DynamoDB key schema is unavailable for this table.");
  }

  const key = Object.fromEntries(
    keyFields.map((field) => [
      field.name,
      parseManualLookupValue(input.lookupValues[field.name] ?? "", field.type),
    ]),
  );
  const response = await client.send(
    new GetItemCommand({
      TableName: input.tableName,
      Key: key,
    }),
  );

  if (!response.Item) {
    throw new AppError("aws-permission", "DynamoDB did not return an item for this key.");
  }

  return {
    primaryKeys: keyFields.map((field) => field.name),
    record: normalizeUnmarshalledDynamoRecord(unmarshall(response.Item)),
  };
}

export async function refetchBackupEntry(input: {
  config: BackupConfig;
  tableName: string;
  key: Record<string, string | number | boolean | null>;
  lookupSource: Record<string, string | number | boolean | null>;
}) {
  const client = await createDynamoClient(input.config);
  const key = await createLookupKey({
    client,
    tableName: input.tableName,
    lookupSource: input.lookupSource,
    fallbackLookupKey: input.key,
  });
  const response = await client.send(
    new GetItemCommand({
      TableName: input.tableName,
      Key: key,
    }),
  );

  if (!response.Item) {
    throw new AppError("aws-permission", "DynamoDB did not return an item for this key.");
  }

  return normalizeUnmarshalledDynamoRecord(unmarshall(response.Item));
}

import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../lib/errors";
import type { BackupConfig, BackupRow, BackupTableDefinition } from "../../../../lib/types";
import { executeEntryLookup } from "./load-entry-by-key";
import { executeRowRefetch } from "./refetch-row";
import { executeTableRefresh } from "./refresh-table";

vi.mock("../../../../lib/aws-browser", async () => {
  const actual = await vi.importActual<object>("../../../../lib/aws-browser");

  return {
    ...actual,
    refetchBackupEntry: vi.fn(),
    refreshBackupTableFromDynamo: vi.fn(),
    fetchBackupEntryByKey: vi.fn(),
  };
});

const awsBrowser = await import("../../../../lib/aws-browser");

function createRow(overrides?: Partial<BackupRow>): BackupRow {
  const row: BackupRow = {
    id: "row-1",
    entity: "269#AniDUB#300",
    region: "eu",
    capturedAt: null,
    backupVersion: "v1",
    checksum: "abc",
    status: "critical",
    structuralIssues: [],
    issues: [
      {
        code: "VIDEOS_STATUS_PUBLISH_FIELDS",
        ruleId: "videos-status-publish-fields",
        scope: "entry",
        severity: "critical",
        message: "status=3 rows must include messageId and publishingDetails.",
        fixed: false,
      },
    ],
    lookupKey: {
      animeKey: "269#AniDUB",
      episode: 300,
    },
    lookupSource: {
      animeKey: "269#AniDUB",
      episode: 300,
    },
    sourceRecord: {
      animeKey: "269#AniDUB",
      episode: 300,
      status: 3,
    },
    rowSourceState: "backup-only",
    liveRecord: null,
    currentRecord: {
      status: "unavailable",
      summary: "Not loaded",
      fields: [],
    },
    rowIdentityKey: "animeKey=269#AniDUB|episode=300",
    stableIdentity: "269#AniDUB#300",
    identitySource: "schema",
    identityState: "schema-backed",
  };

  return { ...row, ...overrides } as BackupRow;
}

function createTable(overrides?: Partial<BackupTableDefinition>): BackupTableDefinition {
  return {
    key: "Bounan-AniMan-videos",
    label: "AniMan Videos",
    description: "Videos",
    partitionKey: "animeKey",
    primaryKeys: ["animeKey", "episode"],
    identitySource: "schema",
    identityState: "schema-backed",
    sourcePath: "videos.jsonl",
    rowCount: 1,
    appliedRules: [],
    ruleFindings: [],
    rows: [createRow()],
    ...overrides,
  };
}

const baseConfig: BackupConfig = {
  githubToken: "token",
  backupRepo: "owner/repo",
  awsRegion: "eu-central-1",
  cognitoUserPoolId: "pool",
  cognitoUserPoolClientId: "client",
  cognitoIdentityPoolId: "identity",
  cognitoUsername: "user",
  cognitoPassword: "password",
  isValidated: true,
  lastValidatedAt: null,
};

describe("AWS recovery actions", () => {
  it("refetches a row and applies revalidated tables", async () => {
    const onApplyTables = vi.fn();
    const onSetTables = vi.fn();
    const onSuccess = vi.fn();
    vi.mocked(awsBrowser.refetchBackupEntry).mockResolvedValue({
      animeKey: "269#AniDUB",
      episode: 300,
      status: 4,
    });

    const result = await executeRowRefetch({
      config: baseConfig,
      tables: [createTable()],
      tableKey: "Bounan-AniMan-videos",
      rowId: "row-1",
      mode: "backup",
      onApplyTables,
      onSetTables,
      onPasswordChallenge: vi.fn(),
      onSuccess,
      onFailure: vi.fn(),
      onBlocked: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ code: "row-refetched", mode: "backup" });
    expect(onApplyTables).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSetTables).not.toHaveBeenCalled();
  });

  it("refreshes a table and reports progress", async () => {
    const onApplyTables = vi.fn();
    const onProgress = vi.fn();
    const onSuccess = vi.fn();
    vi.mocked(awsBrowser.refreshBackupTableFromDynamo).mockImplementation(
      async ({ onProgress }) => {
        onProgress?.({ loadedCount: 1, estimatedCount: 1, pageCount: 1 });
        return {
          records: [{ animeKey: "269#AniDUB", episode: 300, status: 3 }],
          primaryKeys: ["animeKey", "episode"],
          estimatedCount: 1,
          pageCount: 1,
        };
      },
    );

    const result = await executeTableRefresh({
      config: baseConfig,
      tables: [createTable()],
      tableKey: "Bounan-AniMan-videos",
      onProgress,
      onApplyTables,
      onPasswordChallenge: vi.fn(),
      onSuccess,
      onFailure: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ code: "table-refreshed", loadedCount: 1, pageCount: 1 });
    expect(onProgress).toHaveBeenCalled();
    expect(onApplyTables).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("loads a missing entry by key and merges it into the table", async () => {
    const onApplyTables = vi.fn();
    const onSuccess = vi.fn();
    vi.mocked(awsBrowser.fetchBackupEntryByKey).mockResolvedValue({
      primaryKeys: ["animeKey", "episode"],
      record: {
        animeKey: "269#AniDUB",
        episode: 301,
        status: 3,
        myAnimeListId: 269,
        dub: "AniDUB",
        primaryKey: "269#AniDUB#301",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const result = await executeEntryLookup({
      config: baseConfig,
      tables: [createTable()],
      tableKey: "Bounan-AniMan-videos",
      lookupValues: {
        animeKey: "269#AniDUB",
        episode: "301",
      },
      onProgress: vi.fn(),
      onApplyTables,
      onPasswordChallenge: vi.fn(),
      onSuccess,
      onFailure: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ code: "entry-loaded" });
    expect(onApplyTables).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("surfaces permission failures for manual lookup", async () => {
    vi.mocked(awsBrowser.fetchBackupEntryByKey).mockRejectedValue(
      new AppError("aws-permission", "Missing key."),
    );

    const onFailure = vi.fn();
    const result = await executeEntryLookup({
      config: baseConfig,
      tables: [createTable()],
      tableKey: "Bounan-AniMan-videos",
      lookupValues: {
        animeKey: "269#AniDUB",
        episode: "",
      },
      onProgress: vi.fn(),
      onApplyTables: vi.fn(),
      onPasswordChallenge: vi.fn(),
      onSuccess: vi.fn(),
      onFailure,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "aws-failure",
      details: "AWS permissions are insufficient for the requested action. Missing key.",
    });
    expect(onFailure).toHaveBeenCalledWith(
      "AWS permissions are insufficient for the requested action. Missing key.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { normalizeBackupSourceResponse, storageMigrations } from "./storage";

describe("storage normalization", () => {
  it("repairs legacy cached rows using sourceRecord and primaryKeys", () => {
    const payload = normalizeBackupSourceResponse({
      status: {
        ok: true,
        tokenSource: "user",
        repoCount: 1,
        tableFileCount: 1,
        message: "ok",
        version: null,
        repo: null,
      },
      tables: [
        {
          key: "Users",
          label: "Users",
          description: "Users",
          partitionKey: "userId",
          primaryKeys: ["userId", "threadId"],
          identityState: "heuristic-only",
          sourcePath: "Users.jsonl",
          rowCount: 1,
          appliedRules: [],
          ruleFindings: [],
          rows: [
            {
              id: "u-1",
              stableIdentity: null,
              identitySource: "heuristic",
              identityState: "heuristic-only",
              entity: "u-1",
              region: "eu",
              capturedAt: null,
              backupVersion: "v1",
              checksum: "abc",
              status: "warning",
              structuralIssues: [],
              issues: [],
              currentRecord: {
                status: "unavailable",
                summary: "preview",
                fields: [],
              },
              sourceRecord: {
                userId: "u-1",
                threadId: "t-9",
              },
            },
          ],
        },
      ],
      rules: [],
      ruleViolations: [],
      fetchedAt: "2026-04-17T00:00:00.000Z",
    });

    expect(payload?.tables[0]?.rows[0]).toMatchObject({
      lookupSource: {
        userId: "u-1",
        threadId: "t-9",
      },
      lookupKey: {
        userId: "u-1",
        threadId: "t-9",
      },
      sourceRecord: {
        userId: "u-1",
        threadId: "t-9",
      },
      liveRecord: null,
    });
  });

  it("preserves cached rule issues instead of collapsing rows to structural issues only", () => {
    const payload = normalizeBackupSourceResponse({
      status: {
        ok: true,
        tokenSource: "user",
        repoCount: 1,
        tableFileCount: 1,
        message: "ok",
        version: null,
        repo: null,
      },
      tables: [
        {
          key: "Videos",
          label: "Videos",
          description: "Videos",
          partitionKey: "animeKey",
          primaryKeys: ["animeKey"],
          identityState: "heuristic-only",
          sourcePath: "Videos.jsonl",
          rowCount: 1,
          appliedRules: [],
          ruleFindings: [],
          rows: [
            {
              id: "269#AniDUB#300",
              stableIdentity: null,
              identitySource: "heuristic",
              identityState: "heuristic-only",
              entity: "269#AniDUB#300",
              region: "AniDUB",
              capturedAt: null,
              backupVersion: "v1",
              checksum: "abc",
              status: "critical",
              structuralIssues: [],
              issues: [
                {
                  code: "MISSING_PUBLISHING_DETAILS",
                  ruleId: "video-status-fields",
                  scope: "entry",
                  severity: "critical",
                  message: "Publishing details are required when status is 3.",
                  fixed: false,
                },
              ],
              currentRecord: {
                status: "unavailable",
                summary: "preview",
                fields: [],
              },
              sourceRecord: {
                animeKey: "269#AniDUB",
                status: 3,
              },
            },
          ],
        },
      ],
      rules: [],
      ruleViolations: [],
      fetchedAt: "2026-04-17T00:00:00.000Z",
    });

    expect(payload?.tables[0]?.rows[0]?.issues).toHaveLength(1);
    expect(payload?.tables[0]?.rows[0]?.issues[0]).toMatchObject({
      code: "MISSING_PUBLISHING_DETAILS",
      scope: "entry",
      severity: "critical",
    });
    expect(payload?.tables[0]?.rows[0]?.status).toBe("critical");
  });

  it("migrates legacy config payloads into the current schema envelope", () => {
    const migrated = storageMigrations.migrateConfigEnvelope({
      githubToken: "token",
      backupRepo: "owner/repo",
    });

    expect(migrated).toMatchObject({
      schemaVersion: 2,
      data: {
        githubToken: "token",
        backupRepo: "owner/repo",
        isValidated: false,
        lastValidatedAt: null,
      },
    });
  });

  it("migrates legacy refresh-state payloads into the current schema envelope", () => {
    const migrated = storageMigrations.migrateBackupRefreshJob({
      fingerprint: "owner/repo::token",
      state: {
        status: "running",
        message: "Loading...",
      },
    });

    expect(migrated).toMatchObject({
      schemaVersion: 2,
      fingerprint: "owner/repo::token",
      state: {
        status: "running",
        method: null,
        message: "Loading...",
        progress: 0,
        updatedAt: null,
      },
    });
  });
});

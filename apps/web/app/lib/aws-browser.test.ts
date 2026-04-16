import { describe, expect, it } from "vitest";
import {
  applyTableSchemaMetadata,
  CognitoNewPasswordRequiredError,
  createLookupKeyFromSchema,
  normalizeUnmarshalledDynamoRecord,
  resolveCompletedPasswordChallengeResult,
  resolveInitiateAuthResult,
  resolveLookupKeyValues,
} from "./aws-browser";
import { AppError } from "./errors";

describe("aws browser helpers", () => {
  it("prefers lookupSource values over fallback keys", () => {
    expect(
      resolveLookupKeyValues({
        keyNames: ["userId", "threadId"],
        lookupSource: {
          userId: "u-1",
          threadId: "t-2",
        },
        fallbackLookupKey: {
          userId: "fallback-user",
          threadId: "fallback-thread",
        },
      }),
    ).toEqual({
      userId: "u-1",
      threadId: "t-2",
    });
  });

  it("creates DynamoDB attribute values from schema-resolved keys", () => {
    expect(
      createLookupKeyFromSchema({
        keyNames: ["userId", "isActive", "rank"],
        lookupSource: {
          userId: "u-1",
          isActive: true,
          rank: 7,
        },
        fallbackLookupKey: {},
      }),
    ).toEqual({
      userId: { S: "u-1" },
      isActive: { BOOL: true },
      rank: { N: "7" },
    });
  });

  it("throws when schema keys are missing from both lookup sources", () => {
    expect(() =>
      resolveLookupKeyValues({
        keyNames: ["userId", "threadId"],
        lookupSource: { userId: "u-1" },
        fallbackLookupKey: {},
      }),
    ).toThrow("This entry does not expose DynamoDB key fields: threadId.");
  });

  it("raises the Cognito new-password challenge explicitly", () => {
    expect(() =>
      resolveInitiateAuthResult({
        response: {
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          Session: "session-token",
        },
        region: "eu-central-1",
        userPoolId: "pool",
      }),
    ).toThrow(CognitoNewPasswordRequiredError);
  });

  it("throws a typed auth error when Cognito returns no id token", () => {
    expect(() =>
      resolveInitiateAuthResult({
        response: {
          AuthenticationResult: {},
        },
        region: "eu-central-1",
        userPoolId: "pool",
      }),
    ).toThrow(AppError);
  });

  it("throws a typed auth error when the password challenge returns no token", () => {
    expect(() => resolveCompletedPasswordChallengeResult({ AuthenticationResult: {} })).toThrow(
      AppError,
    );
  });

  it("applies schema-backed identity metadata when table keys are known", () => {
    const enriched = applyTableSchemaMetadata(
      [
        {
          key: "Users",
          label: "Users",
          description: "Users",
          partitionKey: "derived-id",
          primaryKeys: ["derived-id"],
          identitySource: "heuristic",
          identityState: "heuristic-only",
          sourcePath: "Users.jsonl",
          rowCount: 1,
          appliedRules: [],
          ruleFindings: [],
          rows: [
            {
              id: "row-1",
              rowIdentityKey: null,
              stableIdentity: null,
              identitySource: "heuristic",
              identityState: "heuristic-only",
              rowSourceState: "backup-only",
              entity: "u-1",
              region: "eu",
              capturedAt: null,
              backupVersion: "v1",
              checksum: "abc",
              status: "healthy",
              structuralIssues: [],
              issues: [],
              lookupKey: { "derived-id": "row-1" },
              lookupSource: { userId: "u-1", threadId: "t-2" },
              sourceRecord: { userId: "u-1", threadId: "t-2" },
              liveRecord: null,
              currentRecord: { status: "unavailable", summary: "x", fields: [] },
            },
          ],
        },
      ],
      new Map([["Users", ["userId", "threadId"]]]),
    );

    expect(enriched[0]).toMatchObject({
      partitionKey: "userId",
      primaryKeys: ["userId", "threadId"],
      identitySource: "schema",
      identityState: "schema-backed",
    });
    expect(enriched[0]?.rows[0]).toMatchObject({
      rowIdentityKey: "userId=u-1 | threadId=t-2",
      identitySource: "schema",
      identityState: "schema-backed",
      stableIdentity: "userId=u-1 | threadId=t-2",
      lookupKey: {
        userId: "u-1",
        threadId: "t-2",
      },
    });
  });

  it("normalizes unmarshalled DynamoDB sets into arrays", () => {
    const normalized = normalizeUnmarshalledDynamoRecord({
      animeKey: "269#AniDUB",
      episodes: new Set([0, 1, 2]),
      nested: {
        tags: new Set(["a", "b"]),
      },
    });

    expect(normalized).toEqual({
      animeKey: "269#AniDUB",
      episodes: [0, 1, 2],
      nested: {
        tags: ["a", "b"],
      },
    });
  });
});

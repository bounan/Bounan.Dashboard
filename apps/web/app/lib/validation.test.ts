import { describe, expect, it } from "vitest";
import { hasAwsConfig, validateAwsConfig, validateBackupConfig } from "./validation";

describe("validation", () => {
  it("accepts a valid GitHub config shape", () => {
    expect(
      validateBackupConfig({
        githubToken: "github_pat_abcdefghijklmnopqrstuvwxyz123456",
        backupRepo: "owner/repo",
      }),
    ).toEqual({
      ok: true,
      issue: null,
    });
  });

  it("rejects incomplete AWS config when AWS setup has started", () => {
    expect(
      validateAwsConfig({
        awsRegion: "",
        cognitoUserPoolId: "pool",
        cognitoUserPoolClientId: "",
        cognitoIdentityPoolId: "",
        cognitoUsername: "",
        cognitoPassword: "",
      }),
    ).toEqual({
      ok: false,
      issue: "AWS region is required",
    });
  });

  it("detects whether AWS fields were actually started", () => {
    expect(
      hasAwsConfig({
        awsRegion: "",
        cognitoUserPoolId: "",
        cognitoUserPoolClientId: "",
        cognitoIdentityPoolId: "",
        cognitoUsername: "",
        cognitoPassword: "",
      }),
    ).toBe(false);

    expect(
      hasAwsConfig({
        awsRegion: "eu-central-1",
        cognitoUserPoolId: "",
        cognitoUserPoolClientId: "",
        cognitoIdentityPoolId: "",
        cognitoUsername: "",
        cognitoPassword: "",
      }),
    ).toBe(true);
  });
});

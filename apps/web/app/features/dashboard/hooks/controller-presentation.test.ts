import { describe, expect, it } from "vitest";
import {
  toAwsValidationFailureStatus,
  toBackupLoadActionResult,
  toBackupSourceResponse,
  toGitHubValidationFailureStatus,
  toSuccessfulConfigValidationStatus,
} from "./controller-presentation";
import type { GitHubBackupDataResult, GitHubRepoAccessResult } from "../../../lib/github-browser";

const githubOk: GitHubRepoAccessResult = {
  ok: true,
  repoCount: 1,
  repo: {
    name: "repo",
    fullName: "owner/repo",
    private: true,
    defaultBranch: "main",
    url: "https://github.com/owner/repo",
  },
  errorCode: null,
  errorDetails: null,
};

describe("controller presentation", () => {
  it("maps GitHub validation failure into UI status", () => {
    const status = toGitHubValidationFailureStatus("owner/repo", {
      ok: false,
      repoCount: 0,
      repo: null,
      errorCode: "github-request",
      errorDetails: "boom",
    });

    expect(status).toMatchObject({
      ok: false,
      tokenSource: "user",
      repoCount: 0,
      tableFileCount: 0,
    });
    expect(status.message).toContain("owner/repo");
  });

  it("maps AWS validation failure into UI status", () => {
    const status = toAwsValidationFailureStatus("AWS region is required", githubOk);

    expect(status).toMatchObject({
      ok: false,
      repoCount: 1,
      message: "AWS region is required",
    });
  });

  it("builds successful config validation status with AWS check counts", () => {
    const result = toSuccessfulConfigValidationStatus({
      githubStatus: githubOk,
      checkedAwsTableCount: 3,
    });

    expect(result.status.ok).toBe(true);
    expect(result.result.ok).toBe(true);
    expect(result.result).toMatchObject({ code: "validated" });
    expect(result.status.message).toContain("Token and repository access validated successfully.");
    expect(result.status.message).toContain("3 table(s)");
  });

  it("maps technical backup payloads into UI backup source response", () => {
    const payload: GitHubBackupDataResult = {
      ok: true,
      repoCount: 1,
      tableFileCount: 2,
      version: {
        id: "abcdef123456",
        label: "abcdef1",
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
      repo: githubOk.repo,
      tables: [],
      rules: [],
      ruleViolations: [],
      fetchedAt: "2026-04-17T10:00:00.000Z",
      errorCode: null,
      errorDetails: null,
    };

    const response = toBackupSourceResponse("owner/repo", payload);
    const actionResult = toBackupLoadActionResult(response);

    expect(response.status.ok).toBe(true);
    expect(response.status.tableFileCount).toBe(2);
    expect(actionResult).toEqual({
      ok: true,
      code: "backup-loaded",
    });
  });
});

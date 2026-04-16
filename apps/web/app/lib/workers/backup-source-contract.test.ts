import { describe, expect, it } from "vitest";
import type {
  BackupSourceWorkerRequest,
  BackupSourceWorkerResponse,
} from "./backup-source-contract";

describe("backup-source worker contract", () => {
  it("supports the load request shape", () => {
    const request: BackupSourceWorkerRequest = {
      type: "load-backup",
      requestId: 1,
      githubToken: "token",
      backupRepo: "owner/repo",
    };

    expect(request.type).toBe("load-backup");
    expect(request.requestId).toBe(1);
  });

  it("supports the failed response shape", () => {
    const response: BackupSourceWorkerResponse = {
      type: "backup-load-failed",
      requestId: 1,
      errorCode: "github-browser",
      error: "boom",
    };

    expect(response.type).toBe("backup-load-failed");
    expect(response.requestId).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import type { BackupViewWorkerRequest, BackupViewWorkerResponse } from "./backup-view-contract";

describe("backup-view worker contract", () => {
  it("supports request ids on hydrate requests", () => {
    const request: BackupViewWorkerRequest = {
      type: "hydrate",
      requestId: 1,
      tables: [],
    };

    expect(request.requestId).toBe(1);
    expect(request.type).toBe("hydrate");
  });

  it("supports typed failure responses", () => {
    const response: BackupViewWorkerResponse = {
      type: "compute-failed",
      requestId: 3,
      errorCode: "missing-table",
      error: "Table is not hydrated.",
    };

    expect(response.type).toBe("compute-failed");
    expect(response.errorCode).toBe("missing-table");
  });
});

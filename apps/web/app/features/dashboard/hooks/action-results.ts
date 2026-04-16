export type ConfigValidationActionResult =
  | { ok: true; challengeRequired: false; code: "validated" }
  | {
      ok: false;
      challengeRequired: false;
      code: "config-invalid" | "github-invalid" | "aws-invalid" | "validation-failed";
      details?: string;
    }
  | { ok: false; challengeRequired: true; code: "password-required" };

export type BackupLoadActionResult =
  | { ok: true; code: "backup-loaded" }
  | {
      ok: false;
      code: "config-invalid" | "validation-required" | "backup-load-failed";
      details?: string;
    };

export type RowRefetchActionResult =
  | { ok: true; challengeRequired: false; code: "row-refetched"; mode: "backup" | "rules" }
  | {
      ok: false;
      challengeRequired: false;
      code: "row-missing" | "heuristic-row" | "aws-failure";
      details?: string;
    }
  | { ok: false; challengeRequired: true; code: "password-required" };

export type TableRefreshActionResult =
  | {
      ok: true;
      challengeRequired: false;
      code: "table-refreshed";
      loadedCount: number;
      pageCount: number;
    }
  | {
      ok: false;
      challengeRequired: false;
      code: "table-missing" | "aws-failure";
      details?: string;
    }
  | { ok: false; challengeRequired: true; code: "password-required" };

export type EntryLookupActionResult =
  | { ok: true; challengeRequired: false; code: "entry-loaded" }
  | {
      ok: false;
      challengeRequired: false;
      code: "table-missing" | "aws-failure";
      details?: string;
    }
  | { ok: false; challengeRequired: true; code: "password-required" };

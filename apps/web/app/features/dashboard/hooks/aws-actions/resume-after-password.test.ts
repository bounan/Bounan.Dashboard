import { describe, expect, it, vi } from "vitest";
import { resumeAwsActionAfterPasswordChallenge } from "./resume-after-password";

describe("resumeAwsActionAfterPasswordChallenge", () => {
  it("resumes table refresh targets", async () => {
    const onRefreshTable = vi.fn().mockResolvedValue(undefined);

    await resumeAwsActionAfterPasswordChallenge({
      target: {
        mode: "table-refresh",
        tableKey: "Videos",
      },
      onRefreshTable,
      onLoadEntryByKey: vi.fn(),
      onRefetchRow: vi.fn(),
    });

    expect(onRefreshTable).toHaveBeenCalledWith("Videos");
  });

  it("resumes manual entry lookup targets", async () => {
    const onLoadEntryByKey = vi.fn().mockResolvedValue(undefined);

    await resumeAwsActionAfterPasswordChallenge({
      target: {
        mode: "entry-lookup",
        tableKey: "Videos",
        lookupValues: { animeKey: "269#AniDUB", episode: "300" },
      },
      onRefreshTable: vi.fn(),
      onLoadEntryByKey,
      onRefetchRow: vi.fn(),
    });

    expect(onLoadEntryByKey).toHaveBeenCalledWith("Videos", {
      animeKey: "269#AniDUB",
      episode: "300",
    });
  });

  it("resumes row refetch targets", async () => {
    const onRefetchRow = vi.fn().mockResolvedValue(undefined);

    await resumeAwsActionAfterPasswordChallenge({
      target: {
        mode: "rules",
        tableKey: "Videos",
        rowId: "row-1",
      },
      onRefreshTable: vi.fn(),
      onLoadEntryByKey: vi.fn(),
      onRefetchRow,
    });

    expect(onRefetchRow).toHaveBeenCalledWith(
      {
        tableKey: "Videos",
        rowId: "row-1",
      },
      "rules",
    );
  });
});

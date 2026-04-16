"use client";

import { useEffect, useState } from "react";
import { getBackupSourceVersionFromGitHub } from "../../../lib/github-browser";
import type { BackupConfig, BackupSourceStatus, DashboardView } from "../../../lib/types";

export function useBackupVersionCheck(input: {
  view: DashboardView;
  config: Pick<BackupConfig, "githubToken" | "backupRepo">;
  source: BackupSourceStatus | null;
}) {
  const [latestVersionId, setLatestVersionId] = useState<string | null>(null);
  const currentSourceVersion = input.source?.version ?? null;
  const shouldSkipVersionCheck =
    input.view !== "backup-analyzer" ||
    !input.source?.ok ||
    !input.config.githubToken ||
    !input.config.backupRepo ||
    !currentSourceVersion;
  const hasUpdateAvailable =
    !shouldSkipVersionCheck &&
    latestVersionId !== null &&
    latestVersionId !== currentSourceVersion.id;

  useEffect(() => {
    if (shouldSkipVersionCheck) {
      return;
    }

    let cancelled = false;

    void getBackupSourceVersionFromGitHub({
      githubToken: input.config.githubToken,
      backupRepo: input.config.backupRepo,
    }).then((version) => {
      if (cancelled || !version) {
        return;
      }

      setLatestVersionId(version.id);
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentSourceVersion,
    input.config.backupRepo,
    input.config.githubToken,
    shouldSkipVersionCheck,
  ]);

  return {
    isCheckingVersion: false,
    hasUpdateAvailable,
    setHasUpdateAvailable(value: boolean) {
      setLatestVersionId(value ? "__stale__" : null);
    },
  };
}

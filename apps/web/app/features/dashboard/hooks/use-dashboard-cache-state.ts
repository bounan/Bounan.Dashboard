"use client";

import { useEffect } from "react";
import { refreshJobRepository, snapshotRepository } from "../../../lib/repositories";
import type { BackupConfig, BackupRefreshState, BackupSourceResponse } from "../../../lib/types";

function normalizeHydratedRefreshState(
  snapshot: BackupSourceResponse | null,
  refreshState: BackupRefreshState,
): BackupRefreshState {
  if (refreshState.status !== "running") {
    return refreshState;
  }

  if (snapshot?.status.ok) {
    return {
      status: "ready",
      method: refreshState.method ?? "worker-fetch",
      message: snapshot.status.message,
      progress: 100,
      updatedAt: refreshState.updatedAt ?? snapshot.fetchedAt,
    };
  }

  return {
    status: "idle",
    method: null,
    message: null,
    progress: 0,
    updatedAt: refreshState.updatedAt,
  };
}

export function useDashboardCacheState(input: {
  config: Pick<BackupConfig, "githubToken" | "backupRepo">;
  onHydrate: (payload: BackupSourceResponse) => void;
  onRefreshState: (state: BackupRefreshState) => void;
}) {
  const { config, onHydrate, onRefreshState } = input;

  useEffect(() => {
    let isCancelled = false;

    void Promise.all([snapshotRepository.read(config), refreshJobRepository.read(config)]).then(
      ([cachedSnapshot, storedState]) => {
        if (isCancelled) {
          return;
        }

        const snapshot = cachedSnapshot.ok ? cachedSnapshot.value : cachedSnapshot.fallback;
        const refreshState = storedState.ok ? storedState.value : storedState.fallback;

        if (snapshot) {
          onHydrate(snapshot);
        }

        onRefreshState(normalizeHydratedRefreshState(snapshot, refreshState));
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [config, onHydrate, onRefreshState]);
}

"use client";

import type { SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { getTableByKey } from "../../../lib/analyzer";
import type { BackupViewWorkerState } from "../../../lib/workers/backup-view-contract";
import {
  computeBackupViewInWorker,
  disposeBackupViewWorkerClient,
  hydrateBackupViewTables,
} from "../../../lib/workers/backup-view-client";
import type { AnalyzerFilters, BackupTableDefinition } from "../../../lib/types";
import { pageSize } from "../utils";

export function useBackupViewWorker(input: {
  tables: BackupTableDefinition[];
  activeTableKey: string | null;
  filters: AnalyzerFilters;
}) {
  const [page, setPage] = useState(1);
  const [workerState, setWorkerState] = useState<BackupViewWorkerState>({ ready: false });
  const activeTable =
    input.tables.length > 0 ? getTableByKey(input.tables, input.activeTableKey) : null;
  const currentViewKey = `${activeTable?.key ?? "none"}::${input.filters.query}::${input.filters.issuesOnly}::${input.filters.status}::${input.filters.sortBy}::${input.filters.sortDirection}::${page}`;
  const activeWorkerState =
    workerState.ready &&
    workerState.tableKey === activeTable?.key &&
    workerState.viewKey === currentViewKey
      ? workerState
      : null;
  const fallbackWorkerState =
    workerState.ready && workerState.tableKey === activeTable?.key ? workerState : null;
  const displayWorkerState = activeWorkerState ?? fallbackWorkerState;
  const isPreparingView = Boolean(activeTable) && !displayWorkerState;
  const sorting = useMemo<SortingState>(
    () => [{ id: input.filters.sortBy, desc: input.filters.sortDirection === "desc" }],
    [input.filters.sortBy, input.filters.sortDirection],
  );

  useEffect(() => {
    return () => {
      disposeBackupViewWorkerClient();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void hydrateBackupViewTables(input.tables).catch(() => {
      if (cancelled) {
        return;
      }
      setWorkerState({ ready: false });
    });

    return () => {
      cancelled = true;
    };
  }, [input.tables]);

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    let cancelled = false;

    void hydrateBackupViewTables(input.tables)
      .then(() =>
        computeBackupViewInWorker({
          tableKey: activeTable.key,
          viewKey: currentViewKey,
          filters: input.filters,
          page,
          pageSize,
        }),
      )
      .then((nextState) => {
        if (cancelled) {
          return;
        }
        setWorkerState(nextState.ready ? nextState : { ready: false });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setWorkerState({ ready: false, viewKey: currentViewKey });
      });

    return () => {
      cancelled = true;
    };
  }, [activeTable, currentViewKey, input.filters, input.tables, page]);

  return {
    activeTable,
    activeWorkerState: displayWorkerState,
    isPreparingView,
    page,
    setPage,
    sorting,
  };
}

"use client";

import { useState } from "react";
import { getTableCounts, getTableHealth } from "../../lib/analyzer";
import type {
  AnalyzerFilters,
  BackupRefreshState,
  BackupSourceStatus,
  BackupTableDefinition,
} from "../../lib/types";
import { formatDate } from "./utils";
import { useBackupViewWorker } from "./hooks/use-backup-view-worker";
import type {
  BackupLoadActionResult,
  EntryLookupActionResult,
  RowRefetchActionResult,
  TableRefreshActionResult,
} from "./hooks/action-results";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BackupFiltersPanel } from "./backup-filters-panel";
import { BackupHero, BackupMetric } from "./backup-shared";
import { BackupRowInspector } from "./backup-row-inspector";
import { BackupTablePanel } from "./backup-table-panel";

export function BackupAnalyzerWorkspace({
  source,
  refreshState,
  hasValidatedConfig,
  currentVersionLabel,
  currentVersionDate,
  hasUpdateAvailable,
  isCheckingVersion,
  tables,
  activeTableKey,
  filters,
  selectedRowId,
  isRefetchingRow,
  isRefreshingTable,
  isLookingUpEntry,
  refreshingTableKey,
  tableRefreshMessage,
  onFiltersChange,
  onSelectRow,
  onRefetchRow,
  onRefreshTable,
  onLoadEntryByKey,
  onOpenConfig,
  onTableChange,
  onLoadBackup,
}: {
  source: BackupSourceStatus | null;
  refreshState: BackupRefreshState;
  hasValidatedConfig: boolean;
  currentVersionLabel: string | null;
  currentVersionDate: string | null;
  hasUpdateAvailable: boolean;
  isCheckingVersion: boolean;
  tables: BackupTableDefinition[];
  activeTableKey: string | null;
  filters: AnalyzerFilters;
  selectedRowId: string | null;
  isRefetchingRow: boolean;
  isRefreshingTable: boolean;
  isLookingUpEntry: boolean;
  refreshingTableKey: string | null;
  tableRefreshMessage: string | null;
  onFiltersChange: (patch: Partial<AnalyzerFilters>) => void;
  onSelectRow: (rowId: string) => void;
  onRefetchRow: () => Promise<RowRefetchActionResult>;
  onRefreshTable: (tableKey: string) => Promise<TableRefreshActionResult>;
  onLoadEntryByKey: (
    tableKey: string,
    lookupValues: Record<string, string>,
  ) => Promise<EntryLookupActionResult>;
  onOpenConfig: () => void;
  onTableChange: (key: string) => void;
  onLoadBackup: () => Promise<BackupLoadActionResult>;
}) {
  const { activeTable, activeWorkerState, isPreparingView, setPage } = useBackupViewWorker({
    tables,
    activeTableKey,
    filters,
  });
  const [lookupValuesByTable, setLookupValuesByTable] = useState<
    Record<string, Record<string, string>>
  >({});
  const activeLookupValues = activeTable
    ? (lookupValuesByTable[activeTable.key] ??
      Object.fromEntries(activeTable.primaryKeys.map((key) => [key, ""])))
    : {};

  if (!activeTable) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <BackupHero
          hasUpdateAvailable={hasUpdateAvailable}
          isBusy={refreshState.status === "running" || isCheckingVersion}
          sourceTableCount={source?.tableFileCount ?? tables.length}
          onOpenConfig={onOpenConfig}
          onLoadBackup={() => void onLoadBackup()}
          loaded={false}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <BackupMetric label="Local version" value={currentVersionLabel ?? "not loaded"} />
          <BackupMetric label="Updated" value={formatDate(currentVersionDate)} />
          <BackupMetric label="Refresh mode" value={refreshState.method ?? "not started"} />
        </div>
        <Alert variant={source?.ok ? "success" : hasValidatedConfig ? "warning" : "default"}>
          <AlertTitle>
            {source?.ok
              ? "Ready to inspect backups"
              : hasValidatedConfig
                ? "Ready to load backup"
                : "Validation required"}
          </AlertTitle>
          <AlertDescription>
            {source?.ok
              ? "A cached or freshly loaded backup snapshot is available."
              : hasValidatedConfig
                ? "Configuration is valid. Load the backup snapshot here when needed."
                : "Validate access on Config before loading backup data."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const counts = activeWorkerState ? activeWorkerState.counts : getTableCounts(activeTable);
  const health = activeWorkerState ? activeWorkerState.health : getTableHealth(activeTable);
  const pageRows = activeWorkerState?.pageRows ?? [];
  const selectedRow = activeTable.rows.find((row) => row.id === selectedRowId) ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackupHero
        hasUpdateAvailable={hasUpdateAvailable}
        isBusy={refreshState.status === "running" || isCheckingVersion}
        sourceTableCount={source?.tableFileCount ?? tables.length}
        onOpenConfig={onOpenConfig}
        onLoadBackup={() => void onLoadBackup()}
        loaded
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BackupMetric label="Local version" value={currentVersionLabel ?? "not loaded"} />
        <BackupMetric label="Updated" value={formatDate(currentVersionDate)} />
        <BackupMetric label="Rows scanned" value={activeTable.rowCount.toString()} />
        <BackupMetric
          label="Update status"
          value={hasUpdateAvailable ? "update available" : "up to date"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <BackupMetric label="Critical" value={counts.critical.toString()} tone="critical" />
        <BackupMetric label="Warnings" value={counts.warning.toString()} tone="warning" />
        <BackupMetric label="Healthy" value={counts.healthy.toString()} tone="healthy" />
        <BackupMetric label="Health" value={health} tone={health} />
      </div>

      <BackupFiltersPanel
        activeTable={activeTable}
        tables={tables}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onTableChange={onTableChange}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <BackupTablePanel
          activeTable={activeTable}
          health={health}
          pageRows={pageRows}
          selectedRowId={selectedRowId}
          isPreparingView={isPreparingView}
          isRefreshingTable={isRefreshingTable}
          isLookingUpEntry={isLookingUpEntry}
          refreshingTableKey={refreshingTableKey}
          tableRefreshMessage={tableRefreshMessage}
          refreshState={refreshState}
          activeWorkerState={
            activeWorkerState
              ? {
                  totalRows: activeWorkerState.totalRows,
                  page: activeWorkerState.page,
                  totalPages: activeWorkerState.totalPages,
                }
              : null
          }
          lookupValues={activeLookupValues}
          onLookupValueChange={(key, value) =>
            setLookupValuesByTable((current) => ({
              ...current,
              [activeTable.key]: {
                ...(current[activeTable.key] ?? {}),
                [key]: value,
              },
            }))
          }
          onSelectRow={onSelectRow}
          onRefreshTable={() => void onRefreshTable(activeTable.key)}
          onLoadEntryByKey={() => void onLoadEntryByKey(activeTable.key, activeLookupValues)}
          onPageChange={setPage}
        />

        <BackupRowInspector
          selectedRow={selectedRow}
          isRefetchingRow={isRefetchingRow}
          onRefetchRow={() => void onRefetchRow()}
        />
      </div>
    </div>
  );
}

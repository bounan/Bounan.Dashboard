"use client";

import { useCallback, useState } from "react";
import type {
  AnalyzerFilters,
  BackupConfig,
  BackupRefreshState,
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupSourceResponse,
  BackupSourceStatus,
  BackupTableDefinition,
} from "../../../lib/types";
import { defaultFilters } from "../utils";
import type { BackupLoadActionResult } from "./action-results";
import { refreshJobRepository } from "../../../lib/repositories";
import { executeBackupLoad } from "./backup-actions/load-backup";
import { useDashboardNotifier } from "./use-dashboard-notifier";

export function useBackupController(input: {
  config: BackupConfig;
  hasValidatedConfig: boolean;
  onRequireConfig: () => void;
}) {
  const [source, setSource] = useState<BackupSourceStatus | null>(null);
  const [tables, setTables] = useState<BackupTableDefinition[]>([]);
  const [rules, setRules] = useState<BackupRuleDefinition[]>([]);
  const [ruleViolations, setRuleViolations] = useState<BackupRuleViolationSummary[]>([]);
  const [filters, setFilters] = useState<AnalyzerFilters>(defaultFilters);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<BackupRefreshState>(
    refreshJobRepository.emptyState,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const notifier = useDashboardNotifier();

  const hydrateLoadedData = useCallback((payload: BackupSourceResponse) => {
    setSource(payload.status);
    setTables(payload.tables);
    setRules(payload.rules);
    setRuleViolations(payload.ruleViolations);
  }, []);

  const clearLoadedData = useCallback(() => {
    setSource(null);
    setTables([]);
    setRules([]);
    setRuleViolations([]);
    setSelectedRowId(null);
    setFilters(defaultFilters);
  }, []);

  const applyTables = useCallback(
    (nextTables: BackupTableDefinition[], nextRuleViolations: BackupRuleViolationSummary[]) => {
      setTables(nextTables);
      setRuleViolations(nextRuleViolations);
    },
    [],
  );

  async function loadBackupData(): Promise<BackupLoadActionResult> {
    return executeBackupLoad({
      config: input.config,
      hasValidatedConfig: input.hasValidatedConfig,
      currentRefreshState: refreshState,
      onRequireConfig: input.onRequireConfig,
      onLoadBlocked: (message) => notifier.loadBlocked(message),
      onValidationRequired: (message) => notifier.validationRequired(message),
      onRunningState: setRefreshState,
      onLoadError: setLoadError,
      onHydrate: hydrateLoadedData,
      onReadyState: setRefreshState,
      onFailedState: setRefreshState,
      onCacheWarning: (message) => notifier.cacheWarning(message),
      onLoaded: () => notifier.backupLoaded(),
      onLoadFailed: (message) => notifier.backupLoadFailed(message),
    });
  }

  return {
    source,
    tables,
    rules,
    ruleViolations,
    filters,
    selectedRowId,
    refreshState,
    loadError,
    setFilters,
    setSelectedRowId,
    setRefreshState,
    hydrateLoadedData,
    clearLoadedData,
    applyTables,
    loadBackupData,
  };
}

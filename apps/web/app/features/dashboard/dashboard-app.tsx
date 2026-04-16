"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { summarizeRuleViolationsForTables } from "../../lib/rule-runtime";
import { refreshJobRepository } from "../../lib/repositories";
import type { BackupConfig } from "../../lib/types";
import { DashboardWorkspace } from "./dashboard-workspace";
import { useAnalyzerRouteSync } from "./hooks/use-analyzer-route-sync";
import { useAwsRefetch } from "./hooks/use-aws-refetch";
import { useBackupController } from "./hooks/use-backup-controller";
import { useBackupVersionCheck } from "./hooks/use-backup-version-check";
import { useConfigController } from "./hooks/use-config-controller";
import { useDashboardNavigation } from "./hooks/use-dashboard-navigation";
import { useDashboardCacheState } from "./hooks/use-dashboard-cache-state";
import { PasswordChangeModal } from "./password-change-modal";
import { Sidebar } from "./sidebar";

export function DashboardApp({
  defaultConfig,
}: {
  defaultConfig: Pick<BackupConfig, "backupRepo">;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigation = useDashboardNavigation();

  const configController = useConfigController({
    defaultConfig,
    onConfigMutated(nextConfig) {
      void refreshJobRepository.write(nextConfig, refreshJobRepository.emptyState);
    },
  });

  const cacheKey = useMemo(
    () => ({
      githubToken: configController.config.githubToken,
      backupRepo: configController.config.backupRepo,
    }),
    [configController.config.backupRepo, configController.config.githubToken],
  );

  const backupController = useBackupController({
    config: configController.config,
    hasValidatedConfig: Boolean(
      configController.validationStatus?.ok || configController.config.isValidated,
    ),
    onRequireConfig: () => navigation.navigate("config"),
  });

  const versionState = useBackupVersionCheck({
    view: navigation.view,
    config: cacheKey,
    source: backupController.source,
  });
  const { clearLoadedData, setRefreshState } = backupController;
  const { setHasUpdateAvailable } = versionState;

  const previousCacheFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const nextFingerprint = `${cacheKey.backupRepo}::${cacheKey.githubToken}`;

    if (previousCacheFingerprintRef.current === null) {
      previousCacheFingerprintRef.current = nextFingerprint;
      return;
    }

    if (previousCacheFingerprintRef.current !== nextFingerprint) {
      previousCacheFingerprintRef.current = nextFingerprint;
      setRefreshState(refreshJobRepository.emptyState);
      clearLoadedData();
      setHasUpdateAvailable(false);
    }
  }, [
    cacheKey.backupRepo,
    cacheKey.githubToken,
    clearLoadedData,
    setHasUpdateAvailable,
    setRefreshState,
  ]);

  useAnalyzerRouteSync({
    view: navigation.view,
    tableKey: navigation.tableKey,
    tables: backupController.tables,
    pathname: navigation.pathname,
    searchParamsString: navigation.searchParams.toString(),
    replace: navigation.replace,
  });

  useDashboardCacheState({
    config: cacheKey,
    onHydrate: backupController.hydrateLoadedData,
    onRefreshState: backupController.setRefreshState,
  });

  const awsRefetch = useAwsRefetch({
    config: configController.config,
    setConfig: configController.setConfig,
    source: backupController.source,
    tables: backupController.tables,
    rules: backupController.rules,
    onApplyTables: (tables) =>
      backupController.applyTables(
        tables,
        summarizeRuleViolationsForTables(tables, backupController.rules),
      ),
    onSetTables: (updater) => {
      const nextTables = updater(backupController.tables);
      backupController.applyTables(
        nextTables,
        summarizeRuleViolationsForTables(nextTables, backupController.rules),
      );
    },
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <PasswordChangeModal
        opened={configController.pendingPasswordSession !== null}
        isSubmitting={configController.isCompletingPasswordChallenge}
        value={configController.newPassword}
        error={configController.newPasswordError}
        onChange={configController.setNewPassword}
        onClose={configController.clearPasswordChallenge}
        onSubmit={async () => {
          await configController.completePasswordChallenge();
        }}
      />
      <PasswordChangeModal
        opened={awsRefetch.pendingPasswordChallenge !== null}
        isSubmitting={awsRefetch.isCompletingPasswordChallenge}
        value={awsRefetch.newPassword}
        error={awsRefetch.newPasswordError}
        onChange={awsRefetch.setNewPassword}
        onClose={awsRefetch.clearPasswordChallenge}
        onSubmit={async () => {
          await awsRefetch.completePasswordChallenge();
        }}
      />

      <div className="grid min-h-screen md:grid-cols-[auto_1fr]">
        <Sidebar
          collapsed={sidebarCollapsed}
          view={navigation.view}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          onNavigate={navigation.navigate}
        />

        <main className="min-w-0">
          <div className="mx-auto max-w-7xl space-y-6 p-6">
            <DashboardWorkspace
              view={navigation.view}
              tableKey={navigation.tableKey}
              configController={configController}
              backupController={backupController}
              awsRefetch={awsRefetch}
              versionState={versionState}
              hasValidatedConfig={Boolean(
                configController.validationStatus?.ok || configController.config.isValidated,
              )}
              onNavigate={navigation.navigate}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

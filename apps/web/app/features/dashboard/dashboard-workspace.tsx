"use client";

import type { DashboardView } from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BackupAnalyzerWorkspace } from "./backup-analyzer-workspace";
import { ConfigWorkspace } from "./config-workspace";
import { RulesWorkspace } from "./rules-workspace";
import type {
  AwsRefetchControllerViewModel,
  BackupControllerViewModel,
  BackupVersionStateViewModel,
  ConfigControllerViewModel,
} from "./contracts";

export function DashboardWorkspace(props: {
  view: DashboardView;
  tableKey: string | null;
  configController: ConfigControllerViewModel;
  backupController: BackupControllerViewModel;
  awsRefetch: AwsRefetchControllerViewModel;
  versionState: BackupVersionStateViewModel;
  hasValidatedConfig: boolean;
  onNavigate: (view: DashboardView, tableKey?: string | null) => void;
}) {
  if (props.backupController.loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Backup source request failed</AlertTitle>
        <AlertDescription>{props.backupController.loadError}</AlertDescription>
      </Alert>
    );
  }

  if (props.view === "config") {
    return (
      <ConfigWorkspace
        config={props.configController.config}
        source={props.configController.validationStatus}
        validationState={props.configController.validationState}
        validationMessage={props.configController.validationMessage}
        saveMessage={props.configController.saveMessage}
        onChange={props.configController.updateConfig}
        onImport={props.configController.importConfig}
        onExport={props.configController.exportConfig}
        onValidate={async () => {
          await props.configController.validateConfigWithTarget(props.configController.config);
        }}
        onSave={props.configController.saveConfig}
      />
    );
  }

  if (props.view === "rules") {
    return (
      <RulesWorkspace
        source={props.backupController.source}
        tables={props.backupController.tables}
        rules={props.backupController.rules}
        violations={props.backupController.ruleViolations}
        updatingViolationKeys={props.awsRefetch.updatingRuleViolationKeys}
        onUpdateViolation={props.awsRefetch.refetchRuleViolation}
        onOpenConfig={() => props.onNavigate("config")}
      />
    );
  }

  return (
    <BackupAnalyzerWorkspace
      source={props.backupController.source}
      refreshState={props.backupController.refreshState}
      hasValidatedConfig={props.hasValidatedConfig}
      currentVersionLabel={props.backupController.source?.version?.label ?? null}
      currentVersionDate={props.backupController.source?.version?.updatedAt ?? null}
      hasUpdateAvailable={props.versionState.hasUpdateAvailable}
      isCheckingVersion={props.versionState.isCheckingVersion}
      tables={props.backupController.tables}
      activeTableKey={props.tableKey}
      filters={props.backupController.filters}
      selectedRowId={props.backupController.selectedRowId}
      isRefetchingRow={props.awsRefetch.isRefetchingRow}
      isRefreshingTable={props.awsRefetch.isRefreshingTable}
      isLookingUpEntry={props.awsRefetch.isLookingUpEntry}
      refreshingTableKey={props.awsRefetch.refreshingTableKey}
      tableRefreshMessage={props.awsRefetch.tableRefreshMessage}
      onFiltersChange={(patch) =>
        props.backupController.setFilters((current) => ({ ...current, ...patch }))
      }
      onSelectRow={props.backupController.setSelectedRowId}
      onRefetchRow={() =>
        props.tableKey && props.backupController.selectedRowId
          ? props.awsRefetch.refetchSelectedRow(
              props.tableKey,
              props.backupController.selectedRowId,
            )
          : Promise.resolve({
              ok: false as const,
              challengeRequired: false as const,
              code: "row-missing" as const,
              details: "No row is selected for refetch.",
            })
      }
      onRefreshTable={props.awsRefetch.refreshTable}
      onLoadEntryByKey={props.awsRefetch.loadEntryByKey}
      onOpenConfig={() => props.onNavigate("config")}
      onTableChange={(nextTable) => props.onNavigate("backup-analyzer", nextTable)}
      onLoadBackup={props.backupController.loadBackupData}
    />
  );
}

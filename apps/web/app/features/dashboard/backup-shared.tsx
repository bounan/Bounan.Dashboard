import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DashboardHeroSection, DashboardSummaryCard } from "./dashboard-shell";

export function backupTone(status: "healthy" | "warning" | "critical") {
  return status === "critical" ? "destructive" : status === "warning" ? "warning" : "success";
}

export function BackupHero({
  hasUpdateAvailable,
  isBusy,
  sourceTableCount,
  onOpenConfig,
  onLoadBackup,
  loaded,
}: {
  hasUpdateAvailable: boolean;
  isBusy: boolean;
  sourceTableCount: number;
  onOpenConfig: () => void;
  onLoadBackup: () => void;
  loaded: boolean;
}) {
  return (
    <DashboardHeroSection
      badge="Backup analyzer"
      title={
        loaded
          ? "Inspect backup tables with quieter, focused controls"
          : "Backup data and refresh operations"
      }
      description="This layout keeps version state, table switching, filtering, AWS actions, and row inspection in one cleaner flow without burying the actual data behind banners."
      actions={
        <>
          <Button variant="secondary" onClick={onOpenConfig}>
            Open config
          </Button>
          <Button disabled={isBusy} onClick={onLoadBackup}>
            {loaded ? (hasUpdateAvailable ? "Update backup" : "Reload backup") : "Load backup"}
          </Button>
          <Badge variant="secondary">{sourceTableCount} tables online</Badge>
        </>
      }
    />
  );
}

export function BackupMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "healthy" | "warning" | "critical";
}) {
  return (
    <DashboardSummaryCard
      label={label}
      value={value}
      aside={tone ? <Badge variant={backupTone(tone)}>{tone}</Badge> : null}
    />
  );
}

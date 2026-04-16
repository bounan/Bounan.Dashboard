"use client";

import dynamic from "next/dynamic";
import type { BackupConfig } from "../../lib/types";

const DashboardApp = dynamic(
  () => import("./dashboard-app").then((module) => module.DashboardApp),
  {
    ssr: false,
    loading: () => <div className="min-h-screen" />,
  },
);

export function DashboardEntry({
  defaultConfig,
}: {
  defaultConfig: Pick<BackupConfig, "backupRepo">;
}) {
  return <DashboardApp defaultConfig={defaultConfig} />;
}

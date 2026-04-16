import { DashboardEntry } from "./features/dashboard/dashboard-entry";

export default function Page() {
  return <DashboardEntry defaultConfig={{ backupRepo: "" }} />;
}

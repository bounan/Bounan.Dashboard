"use client";

import type { BackupConfig } from "../../../../lib/types";

export function exportDashboardConfig(config: BackupConfig) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          githubToken: config.githubToken,
          backupRepo: config.backupRepo,
          awsRegion: config.awsRegion,
          cognitoUserPoolId: config.cognitoUserPoolId,
          cognitoUserPoolClientId: config.cognitoUserPoolClientId,
          cognitoIdentityPoolId: config.cognitoIdentityPoolId,
          cognitoUsername: config.cognitoUsername,
          cognitoPassword: config.cognitoPassword,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bounan-dashboard-config.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

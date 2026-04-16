"use client";

import { configRepository } from "../../../../lib/repositories";
import type { BackupConfig } from "../../../../lib/types";

export function saveDashboardConfig(config: BackupConfig) {
  return configRepository.write(config);
}

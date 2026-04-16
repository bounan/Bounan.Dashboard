"use client";

import { useEffect, useState } from "react";
import { configRepository } from "../../../lib/repositories";
import type { BackupConfig } from "../../../lib/types";

export function useDashboardConfigState(defaultConfig: Pick<BackupConfig, "backupRepo">) {
  const [config, setConfig] = useState<BackupConfig>(() => {
    const storedConfig = configRepository.read();
    const initialConfig = storedConfig.ok ? storedConfig.value : storedConfig.fallback;

    return {
      ...initialConfig,
      backupRepo: initialConfig.backupRepo || defaultConfig.backupRepo,
    };
  });

  useEffect(() => {
    void configRepository.write(config);
  }, [config]);

  return {
    config,
    setConfig,
  };
}

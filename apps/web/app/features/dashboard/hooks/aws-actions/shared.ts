"use client";

import { summarizeRuleViolationsForTables } from "../../../../lib/rule-runtime";
import { snapshotRepository } from "../../../../lib/repositories";
import type {
  BackupConfig,
  BackupSourceStatus,
  BackupTableDefinition,
} from "../../../../lib/types";

export async function persistAwsTables(input: {
  config: BackupConfig;
  source: BackupSourceStatus | null;
  rules: Parameters<typeof summarizeRuleViolationsForTables>[1];
  tables: BackupTableDefinition[];
}) {
  if (!input.source) {
    return;
  }

  await snapshotRepository.write(
    {
      githubToken: input.config.githubToken,
      backupRepo: input.config.backupRepo,
    },
    {
      status: input.source,
      tables: input.tables,
      rules: input.rules,
      ruleViolations: summarizeRuleViolationsForTables(input.tables, input.rules),
      fetchedAt: new Date().toISOString(),
    },
  );
}

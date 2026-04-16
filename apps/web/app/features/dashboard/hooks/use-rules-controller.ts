"use client";

import { useMemo, useState } from "react";
import { buildRulesViewModel } from "../../../lib/rule-runtime";
import type {
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupTableDefinition,
} from "../../../lib/types";

export function useRulesController(input: {
  tables: BackupTableDefinition[];
  rules: BackupRuleDefinition[];
  violations: BackupRuleViolationSummary[];
}) {
  const firstViolatedRuleId =
    input.violations.find((violation) => violation.violationCount > 0)?.ruleId ??
    input.rules[0]?.id ??
    null;
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(firstViolatedRuleId);
  const effectiveSelectedRuleId =
    input.rules.length === 0 ||
    !selectedRuleId ||
    !input.rules.some((rule) => rule.id === selectedRuleId)
      ? firstViolatedRuleId
      : selectedRuleId;

  return {
    selectedRuleId: effectiveSelectedRuleId,
    setSelectedRuleId,
    ...useMemo(
      () =>
        buildRulesViewModel(
          Array.isArray(input.tables) ? input.tables : [],
          Array.isArray(input.rules) ? input.rules : [],
          Array.isArray(input.violations) ? input.violations : [],
          effectiveSelectedRuleId,
        ),
      [effectiveSelectedRuleId, input.rules, input.tables, input.violations],
    ),
  };
}

export type ReturnTypeUseRulesController = ReturnType<typeof useRulesController>;

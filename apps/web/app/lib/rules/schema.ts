import { z } from "zod";

export const ruleDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["entry", "cross-entry", "cross-table"]),
  severity: z.enum(["warning", "critical"]),
  description: z.string().min(1),
  tablePattern: z.string().min(1),
  targetTablePattern: z.string().min(1).nullable().optional(),
});

export const ruleDefinitionCatalogSchema = z.array(ruleDefinitionSchema).min(1);

export type ValidationRuleDefinition = z.infer<typeof ruleDefinitionSchema>;

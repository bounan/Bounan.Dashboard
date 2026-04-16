import type { BackupRuleDefinition } from "../types";
import { ruleDefinitionCatalogSchema, type ValidationRuleDefinition } from "./schema";

const rawRuleDefinitions = [
  {
    id: "videos-schema",
    kind: "entry",
    severity: "critical",
    description:
      "AniMan video rows must expose the required identity, status, timestamp, and optional payload shapes.",
    tablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "videos-identity-shape",
    kind: "cross-entry",
    severity: "critical",
    description:
      "AniMan video identity fields must follow the expected animeKey and primaryKey formulas.",
    tablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "videos-status-publish-fields",
    kind: "entry",
    severity: "critical",
    description:
      "Published AniMan video rows must carry publish payloads, while unpublished rows must not.",
    tablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "videos-scenes-shape",
    kind: "entry",
    severity: "warning",
    description:
      "AniMan scene payloads must use valid segment boundaries and observed scene field names.",
    tablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "videos-library-reference",
    kind: "cross-table",
    severity: "critical",
    description: "Published AniMan video animeKey pairs should exist in Bot Library.",
    tablePattern: "Bounan-AniMan-videos",
    targetTablePattern: "Bounan-Bot-library",
  },
  {
    id: "videos-publisher-reference",
    kind: "cross-table",
    severity: "critical",
    description: "Published AniMan videos should have a matching Publisher row.",
    tablePattern: "Bounan-AniMan-videos",
    targetTablePattern: "Bounan-Publisher-Table",
  },
  {
    id: "videos-publisher-thread-consistency",
    kind: "cross-table",
    severity: "warning",
    description: "Published AniMan thread ids should match the Publisher thread id.",
    tablePattern: "Bounan-AniMan-videos",
    targetTablePattern: "Bounan-Publisher-Table",
  },
  {
    id: "videos-publisher-message-consistency",
    kind: "cross-table",
    severity: "warning",
    description: "Published AniMan message ids should match the Publisher episode message id.",
    tablePattern: "Bounan-AniMan-videos",
    targetTablePattern: "Bounan-Publisher-Table",
  },
  {
    id: "library-schema",
    kind: "entry",
    severity: "critical",
    description: "Bot Library rows must expose valid MAL ids, dub sets, and timestamps.",
    tablePattern: "Bounan-Bot-library",
  },
  {
    id: "library-mal-uniqueness",
    kind: "cross-entry",
    severity: "critical",
    description: "Bot Library MAL ids and derived animeKey pairs must be unique.",
    tablePattern: "Bounan-Bot-library",
  },
  {
    id: "library-video-pair-coverage",
    kind: "cross-table",
    severity: "critical",
    description:
      "Every Bot Library animeKey pair should have at least one published AniMan video row.",
    tablePattern: "Bounan-Bot-library",
    targetTablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "library-video-pair-consistency",
    kind: "cross-table",
    severity: "critical",
    description:
      "Published AniMan video animeKey pairs missing from Bot Library should be treated as consistency drift.",
    tablePattern: "Bounan-Bot-library",
    targetTablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "subscriptions-schema",
    kind: "entry",
    severity: "critical",
    description:
      "Bot Subscription rows must expose valid animeKey, timestamps, and subscriber maps.",
    tablePattern: "Bounan-Bot-subscriptions",
  },
  {
    id: "subscriptions-anime-key-uniqueness",
    kind: "cross-entry",
    severity: "critical",
    description: "There should be at most one Bot Subscription row per animeKey.",
    tablePattern: "Bounan-Bot-subscriptions",
  },
  {
    id: "subscriptions-library-reference",
    kind: "cross-table",
    severity: "critical",
    description: "Every Bot Subscription animeKey should exist in Bot Library.",
    tablePattern: "Bounan-Bot-subscriptions",
    targetTablePattern: "Bounan-Bot-library",
  },
  {
    id: "subscriptions-video-reference",
    kind: "cross-table",
    severity: "critical",
    description: "Every Bot Subscription animeKey should exist in AniMan Videos.",
    tablePattern: "Bounan-Bot-subscriptions",
    targetTablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "users-schema",
    kind: "entry",
    severity: "critical",
    description:
      "Bot User rows must expose valid user ids, integer ranks, timestamps, and requested episode payloads.",
    tablePattern: "Bounan-Bot-users",
  },
  {
    id: "users-id-uniqueness",
    kind: "cross-entry",
    severity: "critical",
    description: "Bot User ids should be unique across the table.",
    tablePattern: "Bounan-Bot-users",
  },
  {
    id: "ongoing-schema",
    kind: "entry",
    severity: "critical",
    description:
      "Ongoing rows must expose valid anime identity, episode sets, sentinel usage, and timestamps.",
    tablePattern: "Bounan-Ongoing-main",
  },
  {
    id: "ongoing-video-episode-coverage",
    kind: "cross-table",
    severity: "critical",
    description: "Positive Ongoing episodes should have matching AniMan video rows.",
    tablePattern: "Bounan-Ongoing-main",
    targetTablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "publisher-schema",
    kind: "entry",
    severity: "critical",
    description:
      "Publisher rows must expose valid AnimeKey identity, header payloads, episode maps, and message uniqueness.",
    tablePattern: "Bounan-Publisher-Table",
  },
  {
    id: "publisher-video-published-anime-reference",
    kind: "cross-table",
    severity: "critical",
    description:
      "Every Publisher row should correspond to at least one published AniMan video row.",
    tablePattern: "Bounan-Publisher-Table",
    targetTablePattern: "Bounan-AniMan-videos",
  },
  {
    id: "publisher-video-published-episode-reference",
    kind: "cross-table",
    severity: "warning",
    description:
      "Every Publisher episode should normally correspond to a published AniMan video row for the same anime and episode.",
    tablePattern: "Bounan-Publisher-Table",
    targetTablePattern: "Bounan-AniMan-videos",
  },
] as const satisfies ValidationRuleDefinition[];

const parsedRuleDefinitions = ruleDefinitionCatalogSchema.parse(rawRuleDefinitions);

export function getRuleDefinitions(): BackupRuleDefinition[] {
  return parsedRuleDefinitions.map((rule) => ({
    id: rule.id,
    kind: rule.kind,
    severity: rule.severity,
    description: rule.description,
    tablePattern: rule.tablePattern,
    targetTablePattern: rule.targetTablePattern ?? null,
  }));
}

export function getRuleDefinitionsForTable(tableKey: string): BackupRuleDefinition[] {
  return getRuleDefinitions().filter((rule) => new RegExp(rule.tablePattern, "i").test(tableKey));
}

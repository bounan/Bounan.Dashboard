import { z } from "zod";
import type { BackupIssue, BackupRuleDefinition, BackupRuleScope } from "../types";
import { getRuleDefinitionsForTable } from "./catalog";
import type {
  LibraryRowContext,
  PublisherRowContext,
  RuleReadyTable,
  TableKind,
  ValidationIndexes,
  VideoRowContext,
} from "./runtime-types";

export const tableMatchers: Record<TableKind, RegExp> = {
  videos: /Bounan-AniMan-videos/i,
  library: /Bounan-Bot-library/i,
  subscriptions: /Bounan-Bot-subscriptions/i,
  users: /Bounan-Bot-users/i,
  ongoing: /Bounan-Ongoing-main/i,
  publisher: /Bounan-Publisher-Table/i,
};

export const positiveIntegerSchema = z.number().int().positive();
export const nonNegativeIntegerSchema = z.number().int().min(0);
export const timestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid timestamp");
export const animeKeySchema = z
  .string()
  .regex(/^\d+#[^#].+$/, "must use `${myAnimeListId}#${dub}` format");
export const sceneSegmentSchema = z
  .object({
    start: z.number().min(0),
    end: z.number().min(0),
  })
  .refine((value) => value.start < value.end, "start must be less than end");
export const scenesSchema = z
  .object({
    opening: sceneSegmentSchema.optional(),
    ending: sceneSegmentSchema.optional(),
    sceneAfterEnding: sceneSegmentSchema.optional(),
  })
  .partial()
  .strict();

export const videoSchema = z
  .object({
    primaryKey: z.string().min(1),
    animeKey: animeKeySchema,
    myAnimeListId: positiveIntegerSchema,
    dub: z.string().min(1),
    episode: nonNegativeIntegerSchema,
    status: z.union([z.literal(1), z.literal(3), z.literal(4)]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    messageId: positiveIntegerSchema.optional(),
    publishingDetails: z
      .object({
        threadId: positiveIntegerSchema,
        messageId: positiveIntegerSchema,
      })
      .strict()
      .optional(),
    scenes: scenesSchema.optional(),
    matchingStatus: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional(),
    matchingGroup: animeKeySchema.optional(),
  })
  .passthrough();

export const librarySchema = z
  .object({
    myAnimeListId: positiveIntegerSchema,
    dubs: z.array(z.string().min(1)).min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .passthrough();

export const subscriptionsSchema = z
  .object({
    animeKey: animeKeySchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    oneTimeSubscribers: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const usersSchema = z
  .object({
    userId: positiveIntegerSchema,
    status: z.literal(0),
    directRank: nonNegativeIntegerSchema,
    indirectRank: nonNegativeIntegerSchema,
    requestedEpisodes: z.array(z.unknown()),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .passthrough();

export const ongoingSchema = z
  .object({
    animeKey: animeKeySchema,
    myAnimeListId: positiveIntegerSchema,
    dub: z.string().min(1),
    episodes: z.array(z.number().int()).min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .passthrough();

export const publisherEpisodeSchema = z
  .object({
    episode: z.number().int().min(0),
    messageId: positiveIntegerSchema,
    hash: z.number(),
  })
  .strict();

export const publisherSchema = z
  .object({
    AnimeKey: animeKeySchema,
    myAnimeListId: positiveIntegerSchema,
    dub: z.string().min(1),
    threadId: positiveIntegerSchema,
    headerPost: z
      .object({
        messageId: positiveIntegerSchema,
        hash: z.number(),
      })
      .strict(),
    episodes: z
      .record(z.string(), publisherEpisodeSchema)
      .refine((value) => Object.keys(value).length > 0, "must contain at least one episode"),
    updatedAt: timestampSchema,
  })
  .passthrough();

export function getTableKind(tableKey: string): TableKind | null {
  for (const [kind, regex] of Object.entries(tableMatchers) as Array<[TableKind, RegExp]>) {
    if (regex.test(tableKey)) {
      return kind;
    }
  }

  return null;
}

export function toRuleCode(ruleId: string) {
  return ruleId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function createIssue(
  rule: BackupRuleDefinition,
  scope: BackupRuleScope,
  message: string,
  relatedTableKey?: string | null,
): BackupIssue {
  return {
    code: toRuleCode(rule.id),
    ruleId: rule.id,
    scope,
    severity: rule.severity,
    message,
    fixed: false,
    relatedTableKey: relatedTableKey ?? null,
  };
}

export function addIssue(
  issueMap: Map<string, BackupIssue[]>,
  rowId: string,
  rule: BackupRuleDefinition,
  scope: BackupRuleScope,
  message: string,
  relatedTableKey?: string | null,
) {
  const rowIssues = issueMap.get(rowId) ?? [];
  rowIssues.push(createIssue(rule, scope, message, relatedTableKey));
  issueMap.set(rowId, rowIssues);
}

export function formatZodIssues(prefix: string, issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `${prefix}${path ? ` ${path}` : ""}: ${issue.message}`;
    })
    .join(" ");
}

export function hasValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as object).length > 0;
  }

  return true;
}

export function isTimestampOrdered(left: string, right: string) {
  return new Date(right).getTime() >= new Date(left).getTime();
}

export function describeAppliedRules(tableKey: string) {
  return getRuleDefinitionsForTable(tableKey)
    .map((rule) => rule.id)
    .sort();
}

export function getRuleOrThrow(ruleId: string, descriptions: Map<string, BackupRuleDefinition>) {
  const rule = descriptions.get(ruleId);

  if (!rule) {
    throw new Error(`Unknown rule definition: ${ruleId}`);
  }

  return rule;
}

export function buildIndexes(tables: RuleReadyTable[]): ValidationIndexes {
  const indexes: ValidationIndexes = {
    videos: [],
    videosByAnimeKey: new Map(),
    videosByPrimaryKey: new Map(),
    publishedVideosByAnimeKey: new Map(),
    publishedVideosByAnimeEpisode: new Map(),
    library: [],
    libraryPairs: new Set(),
    libraryRowsByAnimeKey: new Map(),
    subscriptions: [],
    users: [],
    ongoing: [],
    publisher: [],
    publisherByAnimeKey: new Map(),
    publisherEpisodeByAnimeEpisode: new Map(),
  };

  for (const table of tables) {
    const kind = getTableKind(table.key);

    if (!kind) {
      continue;
    }

    for (const candidate of table.rows) {
      if (kind === "videos") {
        const parsed = videoSchema.safeParse(candidate.record);

        if (!parsed.success) {
          continue;
        }

        const item: VideoRowContext = {
          tableKey: table.key,
          rowId: candidate.row.id,
          rowIdentityKey: candidate.row.rowIdentityKey,
          ruleRow: candidate,
          parsed: parsed.data,
        };
        indexes.videos.push(item);
        indexes.videosByPrimaryKey.set(parsed.data.primaryKey, item);
        indexes.videosByAnimeKey.set(parsed.data.animeKey, [
          ...(indexes.videosByAnimeKey.get(parsed.data.animeKey) ?? []),
          item,
        ]);

        if (parsed.data.status === 3) {
          indexes.publishedVideosByAnimeKey.set(parsed.data.animeKey, [
            ...(indexes.publishedVideosByAnimeKey.get(parsed.data.animeKey) ?? []),
            item,
          ]);
          indexes.publishedVideosByAnimeEpisode.set(
            `${parsed.data.animeKey}#${parsed.data.episode}`,
            item,
          );
        }
      }

      if (kind === "library") {
        const parsed = librarySchema.safeParse(candidate.record);

        if (!parsed.success) {
          continue;
        }

        const item: LibraryRowContext = {
          tableKey: table.key,
          rowId: candidate.row.id,
          rowIdentityKey: candidate.row.rowIdentityKey,
          ruleRow: candidate,
          parsed: parsed.data,
        };
        indexes.library.push(item);

        for (const dub of parsed.data.dubs) {
          const animeKey = `${parsed.data.myAnimeListId}#${dub}`;
          indexes.libraryPairs.add(animeKey);
          indexes.libraryRowsByAnimeKey.set(animeKey, [
            ...(indexes.libraryRowsByAnimeKey.get(animeKey) ?? []),
            item,
          ]);
        }
      }

      if (kind === "subscriptions") {
        const parsed = subscriptionsSchema.safeParse(candidate.record);

        if (parsed.success) {
          indexes.subscriptions.push({
            tableKey: table.key,
            rowId: candidate.row.id,
            rowIdentityKey: candidate.row.rowIdentityKey,
            ruleRow: candidate,
            parsed: parsed.data,
          });
        }
      }

      if (kind === "users") {
        const parsed = usersSchema.safeParse(candidate.record);

        if (parsed.success) {
          indexes.users.push({
            tableKey: table.key,
            rowId: candidate.row.id,
            rowIdentityKey: candidate.row.rowIdentityKey,
            ruleRow: candidate,
            parsed: parsed.data,
          });
        }
      }

      if (kind === "ongoing") {
        const parsed = ongoingSchema.safeParse(candidate.record);

        if (parsed.success) {
          indexes.ongoing.push({
            tableKey: table.key,
            rowId: candidate.row.id,
            rowIdentityKey: candidate.row.rowIdentityKey,
            ruleRow: candidate,
            parsed: parsed.data,
          });
        }
      }

      if (kind === "publisher") {
        const parsed = publisherSchema.safeParse(candidate.record);

        if (!parsed.success) {
          continue;
        }

        const item: PublisherRowContext = {
          tableKey: table.key,
          rowId: candidate.row.id,
          rowIdentityKey: candidate.row.rowIdentityKey,
          ruleRow: candidate,
          parsed: parsed.data,
        };
        indexes.publisher.push(item);
        indexes.publisherByAnimeKey.set(parsed.data.AnimeKey, item);

        for (const episode of Object.values(parsed.data.episodes)) {
          indexes.publisherEpisodeByAnimeEpisode.set(`${parsed.data.AnimeKey}#${episode.episode}`, {
            tableKey: table.key,
            rowId: candidate.row.id,
            animeKey: parsed.data.AnimeKey,
            episode: episode.episode,
            threadId: parsed.data.threadId,
            messageId: episode.messageId,
          });
        }
      }
    }
  }

  return indexes;
}

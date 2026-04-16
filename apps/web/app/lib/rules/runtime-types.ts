import type {
  BackupIdentityState,
  BackupIdentitySource,
  BackupRow,
  BackupRuleDefinition,
} from "../types";

export type JsonRecord = Record<string, unknown>;
export type TableKind = "videos" | "library" | "subscriptions" | "users" | "ongoing" | "publisher";

export interface RuleReadyRow {
  row: BackupRow;
  record: JsonRecord;
}

export interface RuleReadyTable {
  key: string;
  label: string;
  primaryKeys: string[];
  identitySource?: BackupIdentitySource;
  identityState?: BackupIdentityState;
  sourcePath: string;
  rows: RuleReadyRow[];
}

export interface VideoRow {
  primaryKey: string;
  animeKey: string;
  myAnimeListId: number;
  dub: string;
  episode: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  messageId?: number;
  publishingDetails?: {
    threadId: number;
    messageId: number;
  };
  scenes?: Partial<Record<"opening" | "ending" | "sceneAfterEnding", SceneSegment>>;
  matchingStatus?: number;
  matchingGroup?: string;
}

export interface LibraryRow {
  myAnimeListId: number;
  dubs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRow {
  animeKey: string;
  createdAt: string;
  updatedAt: string;
  oneTimeSubscribers: Record<string, unknown>;
}

export interface UserRow {
  userId: number;
  status: number;
  directRank: number;
  indirectRank: number;
  requestedEpisodes: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface OngoingRow {
  animeKey: string;
  myAnimeListId: number;
  dub: string;
  episodes: number[];
  createdAt: string;
  updatedAt: string;
}

export interface PublisherEpisode {
  episode: number;
  messageId: number;
  hash: number;
}

export interface PublisherRow {
  AnimeKey: string;
  myAnimeListId: number;
  dub: string;
  threadId: number;
  headerPost: {
    messageId: number;
    hash: number;
  };
  episodes: Record<string, PublisherEpisode>;
  updatedAt: string;
}

export interface SceneSegment {
  start: number;
  end: number;
}

export interface VideoRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: VideoRow;
}

export interface LibraryRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: LibraryRow;
}

export interface SubscriptionRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: SubscriptionRow;
}

export interface UserRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: UserRow;
}

export interface OngoingRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: OngoingRow;
}

export interface PublisherRowContext {
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  ruleRow: RuleReadyRow;
  parsed: PublisherRow;
}

export interface PublisherEpisodeContext {
  tableKey: string;
  rowId: string;
  animeKey: string;
  episode: number;
  threadId: number;
  messageId: number;
}

export interface ValidationIndexes {
  videos: VideoRowContext[];
  videosByAnimeKey: Map<string, VideoRowContext[]>;
  videosByPrimaryKey: Map<string, VideoRowContext>;
  publishedVideosByAnimeKey: Map<string, VideoRowContext[]>;
  publishedVideosByAnimeEpisode: Map<string, VideoRowContext>;
  library: LibraryRowContext[];
  libraryPairs: Set<string>;
  libraryRowsByAnimeKey: Map<string, LibraryRowContext[]>;
  subscriptions: SubscriptionRowContext[];
  users: UserRowContext[];
  ongoing: OngoingRowContext[];
  publisher: PublisherRowContext[];
  publisherByAnimeKey: Map<string, PublisherRowContext>;
  publisherEpisodeByAnimeEpisode: Map<string, PublisherEpisodeContext>;
}

export interface RuleContext {
  tables: RuleReadyTable[];
  ruleDescriptions: Map<string, BackupRuleDefinition>;
  indexes: ValidationIndexes;
}

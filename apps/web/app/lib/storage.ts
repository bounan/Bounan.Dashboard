import { normalizePersistedBackupSourceResponse } from "./backup-normalizer";
import { AppError } from "./errors";
import type { BackupConfig, BackupRefreshState, BackupSourceResponse } from "./types";

const STORAGE_KEY = "bounan.dashboard.backup-config";
const ANALYZER_DB_NAME = "bounan-dashboard";
const SNAPSHOT_STORE_NAME = "backup-snapshots";
const JOB_STORE_NAME = "backup-jobs";
const ANALYZER_CACHE_KEY = "primary";
const CONFIG_SCHEMA_VERSION = 2;
const SNAPSHOT_SCHEMA_VERSION = 2;
const REFRESH_JOB_SCHEMA_VERSION = 2;

interface PersistedConfigEnvelope {
  schemaVersion: number;
  data: Partial<BackupConfig>;
}

interface BackupAnalyzerCache {
  schemaVersion: number;
  fingerprint: string;
  payload: BackupSourceResponse;
}

interface BackupRefreshJob {
  schemaVersion: number;
  fingerprint: string;
  state: BackupRefreshState;
}

function isPersistedConfigEnvelope(value: unknown): value is PersistedConfigEnvelope {
  return Boolean(
    value &&
    typeof value === "object" &&
    "data" in value &&
    value.data &&
    typeof value.data === "object",
  );
}

export const emptyBackupConfig: BackupConfig = {
  githubToken: "",
  backupRepo: "",
  awsRegion: "",
  cognitoUserPoolId: "",
  cognitoUserPoolClientId: "",
  cognitoIdentityPoolId: "",
  cognitoUsername: "",
  cognitoPassword: "",
  isValidated: false,
  lastValidatedAt: null,
};

export const emptyBackupRefreshState: BackupRefreshState = {
  status: "idle",
  method: null,
  message: null,
  progress: 0,
  updatedAt: null,
};

function migrateConfigEnvelope(
  parsed: Partial<BackupConfig> | PersistedConfigEnvelope,
): PersistedConfigEnvelope {
  if (isPersistedConfigEnvelope(parsed)) {
    if (parsed.schemaVersion >= CONFIG_SCHEMA_VERSION) {
      return parsed;
    }

    return {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      data: {
        ...parsed.data,
        isValidated: parsed.data.isValidated ?? false,
        lastValidatedAt: parsed.data.lastValidatedAt ?? null,
      },
    };
  }

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    data: {
      ...parsed,
      isValidated: parsed.isValidated ?? false,
      lastValidatedAt: parsed.lastValidatedAt ?? null,
    },
  };
}

function migrateBackupAnalyzerCache(
  value: BackupAnalyzerCache | { fingerprint: string; payload: unknown },
): BackupAnalyzerCache | null {
  const payload = normalizeBackupSourceResponse(value.payload);

  if (!payload) {
    return null;
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    fingerprint: value.fingerprint,
    payload,
  };
}

function migrateBackupRefreshJob(
  value: BackupRefreshJob | { fingerprint: string; state: Partial<BackupRefreshState> },
): BackupRefreshJob {
  return {
    schemaVersion: REFRESH_JOB_SCHEMA_VERSION,
    fingerprint: value.fingerprint,
    state: {
      ...emptyBackupRefreshState,
      ...value.state,
    },
  };
}

export function readBackupConfig(): BackupConfig {
  if (typeof window === "undefined") {
    return emptyBackupConfig;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return emptyBackupConfig;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BackupConfig> | PersistedConfigEnvelope;
    const candidate = migrateConfigEnvelope(parsed).data;

    return {
      githubToken: candidate.githubToken ?? "",
      backupRepo: candidate.backupRepo ?? "",
      awsRegion: candidate.awsRegion ?? "",
      cognitoUserPoolId: candidate.cognitoUserPoolId ?? "",
      cognitoUserPoolClientId: candidate.cognitoUserPoolClientId ?? "",
      cognitoIdentityPoolId: candidate.cognitoIdentityPoolId ?? "",
      cognitoUsername: candidate.cognitoUsername ?? "",
      cognitoPassword: candidate.cognitoPassword ?? "",
      isValidated: candidate.isValidated ?? false,
      lastValidatedAt: candidate.lastValidatedAt ?? null,
    };
  } catch (error) {
    throw new AppError("storage-read", "Failed to read config from local storage.", {
      cause: error,
    });
  }
}

export function writeBackupConfig(config: BackupConfig) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedConfigEnvelope = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    data: config,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    throw new AppError("storage-write", "Failed to write config to local storage.", {
      cause: error,
    });
  }
}

export function normalizeBackupSourceResponse(payload: unknown): BackupSourceResponse | null {
  return normalizePersistedBackupSourceResponse(payload);
}

function createFingerprint(config: Pick<BackupConfig, "githubToken" | "backupRepo">) {
  return `${config.backupRepo}::${config.githubToken}`;
}

export function readBackupAnalyzerCache(
  config: Pick<BackupConfig, "githubToken" | "backupRepo">,
): Promise<BackupSourceResponse | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  return withStore(SNAPSHOT_STORE_NAME, "readonly", (store) =>
    requestToPromise<BackupAnalyzerCache | { fingerprint: string; payload: unknown } | undefined>(
      store.get(ANALYZER_CACHE_KEY),
    ),
  ).then((parsed) => {
    if (!parsed || parsed.fingerprint !== createFingerprint(config) || !parsed.payload) {
      return null;
    }

    return migrateBackupAnalyzerCache(parsed)?.payload ?? null;
  });
}

export function writeBackupAnalyzerCache(
  config: Pick<BackupConfig, "githubToken" | "backupRepo">,
  payload: BackupSourceResponse,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const entry: BackupAnalyzerCache = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    fingerprint: createFingerprint(config),
    payload,
  };

  return withStore(SNAPSHOT_STORE_NAME, "readwrite", (store) =>
    requestToPromise(store.put(entry, ANALYZER_CACHE_KEY)).then(() => undefined),
  );
}

export function readBackupRefreshState(
  config: Pick<BackupConfig, "githubToken" | "backupRepo">,
): Promise<BackupRefreshState> {
  if (typeof window === "undefined") {
    return Promise.resolve(emptyBackupRefreshState);
  }

  return withStore(JOB_STORE_NAME, "readonly", (store) =>
    requestToPromise<
      BackupRefreshJob | { fingerprint: string; state: Partial<BackupRefreshState> } | undefined
    >(store.get(ANALYZER_CACHE_KEY)),
  ).then((entry) => {
    if (!entry || entry.fingerprint !== createFingerprint(config) || !entry.state) {
      return emptyBackupRefreshState;
    }

    return migrateBackupRefreshJob(entry).state;
  });
}

export function writeBackupRefreshState(
  config: Pick<BackupConfig, "githubToken" | "backupRepo">,
  state: BackupRefreshState,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const entry: BackupRefreshJob = {
    schemaVersion: REFRESH_JOB_SCHEMA_VERSION,
    fingerprint: createFingerprint(config),
    state,
  };

  return withStore(JOB_STORE_NAME, "readwrite", (store) =>
    requestToPromise(store.put(entry, ANALYZER_CACHE_KEY)).then(() => undefined),
  );
}

function openAnalyzerDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(ANALYZER_DB_NAME, 2);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(SNAPSHOT_STORE_NAME);
      }

      if (!db.objectStoreNames.contains(JOB_STORE_NAME)) {
        db.createObjectStore(JOB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
) {
  return openAnalyzerDb().then((db) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    return callback(store).finally(() => {
      db.close();
    });
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const storageMigrations = {
  migrateConfigEnvelope,
  migrateBackupAnalyzerCache,
  migrateBackupRefreshJob,
};

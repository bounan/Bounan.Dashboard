import { applyValidationRules, summarizeRuleViolations, type RuleReadyTable } from "./rules/engine";
import { getRuleDefinitions } from "./rules/catalog";
import { decodeDynamoRecord } from "./rules/dynamo";
import { getRuleDescriptionMap } from "./backup-domain";
import { buildRuleReadyTableFromRecords, formatBackupTableLabel } from "./backup-normalizer";
import { AppError } from "./errors";
import { validateBackupConfig } from "./validation";
import type {
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupSourceStatus,
  BackupTableDefinition,
} from "./types";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      date: string;
    };
  };
}

export interface GitHubRepoSummary {
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

export interface GitHubRepoAccessResult {
  ok: boolean;
  repoCount: number;
  repo: GitHubRepoSummary | null;
  errorCode: "validation" | "github-request" | "unexpected" | null;
  errorDetails: string | null;
}

export interface GitHubBackupDataResult {
  ok: boolean;
  repoCount: number;
  tableFileCount: number;
  version: BackupSourceStatus["version"];
  repo: GitHubRepoSummary | null;
  tables: BackupTableDefinition[];
  rules: BackupRuleDefinition[];
  ruleViolations: BackupRuleViolationSummary[];
  fetchedAt: string;
  errorCode: "validation" | "github-request" | "unexpected" | null;
  errorDetails: string | null;
}

class GitHubRequestError extends AppError {
  status: number;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(
      status === 401
        ? "github-auth"
        : status === 403
          ? "github-forbidden"
          : status === 404
            ? "github-not-found"
            : "github-request",
      message,
      options,
    );
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

async function createGitHubRequestError(response: Response, fallback: string) {
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");
  let responseMessage: string | undefined;

  try {
    const payload = (await response.json()) as { message?: string };
    responseMessage = payload.message?.trim();
  } catch {
    responseMessage = undefined;
  }

  if (response.status === 401) {
    return new GitHubRequestError(
      "GitHub rejected the token. Verify that the token is correct and active.",
      401,
    );
  }

  if (response.status === 403 && rateLimitRemaining === "0") {
    const resetText =
      rateLimitReset && !Number.isNaN(Number(rateLimitReset))
        ? ` GitHub rate limits reset at ${new Date(Number(rateLimitReset) * 1000).toLocaleString()}.`
        : "";

    return new AppError("github-rate-limit", `GitHub API rate limit exceeded.${resetText}`);
  }

  if (response.status === 403) {
    return new GitHubRequestError(
      "GitHub denied access to this repository or API resource. Check token scopes and repository permissions.",
      403,
    );
  }

  if (response.status === 404) {
    return new GitHubRequestError(
      "The configured repository was not found or is not visible to this token.",
      404,
    );
  }

  return new GitHubRequestError(
    responseMessage ? `${fallback}: ${responseMessage}` : `${fallback} (${response.status})`,
    response.status,
  );
}

async function githubFetchJson<T>(
  path: string,
  token: string,
  accept = "application/vnd.github+json",
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "User-Agent": "bounan-dashboard",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw await createGitHubRequestError(response, "GitHub API request failed");
  }

  return (await response.json()) as T;
}

async function githubFetchText(path: string, token: string) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "bounan-dashboard",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw await createGitHubRequestError(response, "GitHub file request failed");
  }

  return response.text();
}

export function parseJsonlDocument(contents: string) {
  const records: unknown[] = [];

  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      records.push(JSON.parse(trimmed));
    } catch (error) {
      throw new AppError(
        "jsonl-parse",
        `Invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : "Malformed JSON"}`,
        { cause: error },
      );
    }
  }

  return records;
}

export function detectPrimaryKeys(records: Record<string, unknown>[]) {
  if (records.length === 0) {
    return ["derived-id"];
  }

  const preferredCandidates = [
    "primaryKey",
    "animeKey",
    "AnimeKey",
    "userId",
    "myAnimeListId",
    "threadId",
    "id",
    "key",
    "name",
  ];
  const presentFields = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      presentFields.add(key);
    }
  }

  const scoredCandidates = [...presentFields]
    .map((field) => {
      const values = records
        .map((record) => record[field])
        .filter((value) => value !== null && value !== undefined && value !== "");
      const distinctValues = new Set(values.map((value) => JSON.stringify(value)));

      return {
        field,
        presentRatio: values.length / records.length,
        distinctRatio: distinctValues.size / records.length,
        preferredIndex: preferredCandidates.indexOf(field),
      };
    })
    .filter((candidate) => candidate.presentRatio >= 0.95 && candidate.distinctRatio >= 0.95)
    .sort((left, right) => {
      const leftPreferred =
        left.preferredIndex === -1 ? Number.MAX_SAFE_INTEGER : left.preferredIndex;
      const rightPreferred =
        right.preferredIndex === -1 ? Number.MAX_SAFE_INTEGER : right.preferredIndex;

      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }

      if (left.distinctRatio !== right.distinctRatio) {
        return right.distinctRatio - left.distinctRatio;
      }

      return right.presentRatio - left.presentRatio;
    });

  if (scoredCandidates.length > 0) {
    return scoredCandidates.slice(0, 2).map((candidate) => candidate.field);
  }

  for (const field of preferredCandidates) {
    if (presentFields.has(field)) {
      return [field];
    }
  }

  return ["derived-id"];
}

function normalizeRuleReadyTable(name: string, path: string, records: unknown[]): RuleReadyTable {
  const decodedRecords = records.map((record) => decodeDynamoRecord(record));
  const primaryKeys = detectPrimaryKeys(decodedRecords);

  return buildRuleReadyTableFromRecords({
    key: name.replace(/\.jsonl$/i, ""),
    label: formatBackupTableLabel(name),
    primaryKeys,
    identitySource: "heuristic",
    sourcePath: path,
    records: decodedRecords,
  });
}

async function getConfiguredRepo(token: string, fullName: string) {
  return githubFetchJson<GitHubRepo>(`/repos/${fullName}`, token);
}

async function listRootJsonlFiles(token: string, fullName: string) {
  const contents = await githubFetchJson<GitHubContentItem[]>(`/repos/${fullName}/contents`, token);

  return contents.filter(
    (item) => item.type === "file" && item.name.toLowerCase().endsWith(".jsonl"),
  );
}

export async function listRootJsonlTableNamesFromGitHub(input: {
  githubToken: string;
  backupRepo: string;
}) {
  const files = await listRootJsonlFiles(input.githubToken, input.backupRepo);
  return files.map((file) => file.name.replace(/\.jsonl$/i, ""));
}

async function getLatestCommit(token: string, fullName: string, branch: string) {
  return githubFetchJson<GitHubCommit>(`/repos/${fullName}/commits/${branch}`, token);
}

export async function validateBackupSourceAccessFromGitHub(input: {
  githubToken: string;
  backupRepo: string;
}): Promise<GitHubRepoAccessResult> {
  const configValidation = validateBackupConfig(input);

  if (!configValidation.ok) {
    return {
      ok: false,
      repoCount: 0,
      repo: null,
      errorCode: "validation",
      errorDetails: configValidation.issue,
    };
  }

  try {
    const repo = await getConfiguredRepo(input.githubToken, input.backupRepo);

    return {
      ok: true,
      repoCount: 1,
      repo: {
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
      },
      errorCode: null,
      errorDetails: null,
    };
  } catch (error) {
    return {
      ok: false,
      repoCount: 0,
      repo: null,
      errorCode: error instanceof AppError ? "github-request" : "unexpected",
      errorDetails: error instanceof Error ? error.message : null,
    };
  }
}

export async function getBackupSourceVersionFromGitHub(input: {
  githubToken: string;
  backupRepo: string;
}): Promise<BackupSourceStatus["version"]> {
  const configValidation = validateBackupConfig(input);

  if (!configValidation.ok) {
    return null;
  }

  const repo = await getConfiguredRepo(input.githubToken, input.backupRepo);
  const commit = await getLatestCommit(input.githubToken, input.backupRepo, repo.default_branch);

  return {
    id: commit.sha,
    label: commit.sha.slice(0, 7),
    updatedAt: commit.commit.author.date,
  };
}

export async function getBackupSourceDataFromGitHub(input: {
  githubToken: string;
  backupRepo: string;
}): Promise<GitHubBackupDataResult> {
  const configValidation = validateBackupConfig(input);

  if (!configValidation.ok) {
    return {
      ok: false,
      repoCount: 0,
      tableFileCount: 0,
      version: null,
      repo: null,
      tables: [],
      rules: [],
      ruleViolations: [],
      fetchedAt: new Date().toISOString(),
      errorCode: "validation",
      errorDetails: configValidation.issue,
    };
  }

  try {
    const repo = await getConfiguredRepo(input.githubToken, input.backupRepo);
    const [tableFiles, latestCommit] = await Promise.all([
      listRootJsonlFiles(input.githubToken, input.backupRepo),
      getLatestCommit(input.githubToken, input.backupRepo, repo.default_branch),
    ]);

    const payloads = await Promise.all(
      tableFiles.map(async (file) => ({
        file,
        text: await githubFetchText(
          `/repos/${input.backupRepo}/contents/${file.path}`,
          input.githubToken,
        ),
      })),
    );

    const rules = getRuleDefinitions();
    const tables = applyValidationRules(
      payloads.map(({ file, text }) =>
        normalizeRuleReadyTable(file.name, file.path, parseJsonlDocument(text)),
      ),
    );
    const ruleViolations = summarizeRuleViolations(tables, getRuleDescriptionMap(rules));

    return {
      ok: true,
      repoCount: 1,
      tableFileCount: tableFiles.length,
      version: {
        id: latestCommit.sha,
        label: latestCommit.sha.slice(0, 7),
        updatedAt: latestCommit.commit.author.date,
      },
      repo: {
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
      },
      tables,
      rules,
      ruleViolations,
      fetchedAt: new Date().toISOString(),
      errorCode: null,
      errorDetails: null,
    };
  } catch (error) {
    return {
      ok: false,
      repoCount: 0,
      tableFileCount: 0,
      version: null,
      repo: null,
      tables: [],
      rules: [],
      ruleViolations: [],
      fetchedAt: new Date().toISOString(),
      errorCode: error instanceof AppError ? "github-request" : "unexpected",
      errorDetails: error instanceof Error ? error.message : null,
    };
  }
}

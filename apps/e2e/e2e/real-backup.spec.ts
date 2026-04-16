import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function readRootEnvValue(key: string) {
  const envPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", ".env");

  if (!existsSync(envPath)) {
    return null;
  }

  const contents = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = contents.match(new RegExp(`(?:^|\\r?\\n)${escaped}=(.+?)(?:\\r?\\n|$)`));

  return match?.[1]?.trim() ?? null;
}

const backupToken = readRootEnvValue("BACKUP_TOKEN") ?? readRootEnvValue("GITHUB_TOKEN");
const backupRepo = readRootEnvValue("BACKUP_REPO") ?? readRootEnvValue("GITHUB_REPO");
const runRealBackupE2E = process.env.RUN_REAL_BACKUP_E2E === "1";

test.describe("real backup flow", () => {
  test.skip(
    !runRealBackupE2E || !backupToken || !backupRepo,
    "RUN_REAL_BACKUP_E2E=1 and valid BACKUP_TOKEN/BACKUP_REPO values are required for the real-token suite.",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/?view=config");
    await page.evaluate(async () => {
      window.localStorage.clear();
      await new Promise<void>((resolve) => {
        const request = window.indexedDB.deleteDatabase("bounan-dashboard");
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  async function fillConfig(page: Page) {
    await page.getByLabel("GitHub token").fill(backupToken!);
    await page.getByLabel("Backup repo").fill(backupRepo!);
  }

  test("persists config across reload", async ({ page }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Save config" }).click();

    await expect(page.getByText("Configuration saved to local browser storage.")).toBeVisible();
    await page.reload();

    await expect(page.getByLabel("GitHub token")).toHaveValue(backupToken!);
    await expect(page.getByLabel("Backup repo")).toHaveValue(backupRepo!);
  });

  test("shows a clear empty Rules state before validation", async ({ page }) => {
    await page.goto("/?view=rules");

    await expect(page.getByTestId("rules-empty-state")).toBeVisible();
    await expect(page.getByText("Rules need a validated backup snapshot")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open config" })).toBeVisible();
  });

  test("validates config without fetching backup data", async ({ page }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check" }).click();

    await expect(page.getByText("GitHub access verified")).toBeVisible();
    await expect(page.getByTestId("config-summary-github-token")).toContainText(backupToken!);
    await expect(page).toHaveURL(/view=config/);

    await page.getByTestId("nav-backup-analyzer").click();
    await expect(page.getByText(/Backup data and refresh operations/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Load backup" })).toBeVisible();
    await expect(page.getByText("Ready to load backup")).toBeVisible();
  });

  test("loads real backup data from the Backup page and renders the Rules workflow", async ({
    page,
  }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("GitHub access verified")).toBeVisible();

    await page.getByTestId("nav-backup-analyzer").click();
    await page.getByRole("button", { name: /Load backup|Update backup/i }).click();

    await expect
      .poll(async () => {
        return (
          (await page
            .getByText(/Backup snapshot ready|Preparing table in background/i)
            .isVisible()
            .catch(() => false)) ||
          (await page
            .getByText(/No tables loaded|Awaiting manual check/i)
            .isVisible()
            .catch(() => false)) ||
          (await page
            .getByText(/tables online/i)
            .isVisible()
            .catch(() => false))
        );
      })
      .toBeTruthy();

    await page.getByTestId("nav-rules").click();
    await expect(page.getByTestId("rules-workspace")).toBeVisible();
    await expect(page.getByText("Structured validation catalog and live violations")).toBeVisible();
    await expect(page.getByText("Rule Catalog")).toBeVisible();
    await expect(page.getByText("Violation Summary")).toBeVisible();
    await expect(page.getByTestId("rules-count")).not.toHaveText("0");
    await expect(page.getByTestId("rule-card").first()).toBeVisible();
  });

  test("shows full backup rows by default and does not stay stuck after update", async ({
    page,
  }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("GitHub access verified")).toBeVisible();

    await page.getByTestId("nav-backup-analyzer").click();
    await page.getByRole("button", { name: /Load backup|Update backup/i }).click();

    await expect(page.getByText(/Backup snapshot ready/i)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/matching rows/i)).toBeVisible();

    const matchingText = await page.getByText(/matching rows/i).textContent();
    const matchingCount = Number((matchingText ?? "").match(/\d+/)?.[0] ?? "0");
    expect(matchingCount).toBeGreaterThan(2);

    const rowCountBefore = await page.locator("tbody tr").count();
    expect(rowCountBefore).toBeGreaterThan(2);

    await page.getByRole("button", { name: /Reload backup|Update backup/i }).click();
    await expect(page.getByText(/Backup refresh in progress/i)).toBeVisible();
    await expect(page.getByText(/Backup snapshot ready/i)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/Preparing table in background/i)).toHaveCount(0);
    await expect(page.getByText(/matching rows/i)).toBeVisible();

    const rowCountAfter = await page.locator("tbody tr").count();
    expect(rowCountAfter).toBeGreaterThan(2);
  });

  test("does not restore a stale running refresh state after reload", async ({ page }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("GitHub access verified")).toBeVisible();

    await page.getByTestId("nav-backup-analyzer").click();
    await page.getByRole("button", { name: /Load backup|Update backup/i }).click();
    await expect(page.getByText(/Backup snapshot ready/i)).toBeVisible({ timeout: 120_000 });

    await page.evaluate(
      ({ token, repo }) => {
        const request = window.indexedDB.open("bounan-dashboard", 2);

        return new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("backup-jobs", "readwrite");
            const store = transaction.objectStore("backup-jobs");

            store.put(
              {
                fingerprint: `${repo}::${token}`,
                state: {
                  status: "running",
                  method: "worker-fetch",
                  message: "Preparing backup refresh...",
                  progress: 12,
                  updatedAt: new Date().toISOString(),
                },
              },
              "primary",
            );

            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        });
      },
      { token: backupToken!, repo: backupRepo! },
    );

    await page.reload();
    await expect(page.getByText(/Backup refresh in progress/i)).toHaveCount(0);
    await expect(page.getByText(/Backup snapshot ready/i)).toBeVisible();
    await expect(page.getByText(/matching rows/i)).toBeVisible();
  });

  test("does not crash on Rules when a legacy cache payload is missing rules", async ({ page }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("GitHub access verified")).toBeVisible();
    await page.getByTestId("nav-backup-analyzer").click();
    await page.getByRole("button", { name: /Load backup|Update backup/i }).click();
    await expect(page.getByText(/tables online/i)).toBeVisible();

    await page.evaluate(
      ({ token, repo }) => {
        const request = window.indexedDB.open("bounan-dashboard", 2);

        return new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("backup-snapshots", "readwrite");
            const store = transaction.objectStore("backup-snapshots");
            const getRequest = store.get("primary");

            getRequest.onerror = () => reject(getRequest.error);
            getRequest.onsuccess = () => {
              const entry = getRequest.result as
                | {
                    fingerprint: string;
                    payload: Record<string, unknown>;
                  }
                | undefined;

              if (!entry) {
                reject(new Error("Cache entry not found"));
                return;
              }

              store.put(
                {
                  fingerprint: `${repo}::${token}`,
                  payload: {
                    ...entry.payload,
                    rules: undefined,
                    ruleViolations: undefined,
                    tables: Array.isArray(entry.payload.tables)
                      ? entry.payload.tables.map((table) => ({
                          ...table,
                          primaryKeys: undefined,
                        }))
                      : entry.payload.tables,
                  },
                },
                "primary",
              );
            };

            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        });
      },
      { token: backupToken!, repo: backupRepo! },
    );

    await page.goto("/?view=rules");

    await expect(page.getByTestId("rules-empty-state")).toBeVisible();
    await expect(page.getByText("No rules were produced for this snapshot")).toBeVisible();
  });
});

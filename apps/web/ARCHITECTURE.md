# Web Architecture

## State model

The dashboard does not currently need Redux or RTK.

Why:

- Most state is feature-local and short-lived.
- The hard parts are async orchestration, background workers, cache persistence, and domain normalization.
- Adding a global store now would duplicate the controller hooks without removing the core complexity.

Current state boundaries:

- `useConfigController`: form state, validation, import/export, Cognito password challenge during validation
- `useBackupController`: snapshot loading, cached source state, refresh state, table selection/filter state
- `useAwsRefetch`: row refetch actions and Cognito password challenge during live lookup
- `useRulesController`: rule-tree selection and derived violation view state

Controller action results:

- async feature actions return typed result objects instead of relying only on side effects
- examples:
  - config validation returns success vs challenge-required state
  - backup load returns success vs failure message
  - row refetch returns success vs challenge-required vs failure state

If the app later needs:

- cross-page optimistic mutation
- websocket-driven shared state
- undo/redo across multiple features
- normalized entity caches shared across many independent screens

then RTK can be reconsidered. It is not the right next step today.

## Backup domain model

Source-of-truth fields:

- `sourceRecord`: backup row as parsed from GitHub JSONL
- `liveRecord`: live row fetched from DynamoDB
- `lookupSource`: scalar subset of the row used to derive stable lookup values
- `structuralIssues`: baseline row issues from normalization and structural checks
- `ruleFindings`: explicit rule-engine output for a table

Derived fields:

- `lookupKey`: derived from `lookupSource` plus `primaryKeys`
- `status`: derived from structural issues plus rule issues
- `issues`: presentation-layer union of `structuralIssues` and rule-derived issues
- `ruleViolations`: table-level summaries derived from `ruleFindings`
- `BackupRuleViolationItem`: UI projection derived from `ruleFindings` plus row metadata

## Flow

1. GitHub JSONL is fetched and parsed.
2. Parsed records are normalized into rows and lookup sources.
3. Rule engine evaluates records and emits `ruleFindings`.
4. UI-facing row issues are derived from `structuralIssues + ruleFindings`.
5. Cached snapshots are normalized again on restore to repair legacy payloads.

## AWS recovery

AWS recovery is intentionally layered:

1. `aws-browser.ts` re-exports low-level Cognito and Dynamo helpers.
2. `hooks/aws-actions/*` owns concrete recovery commands:
   - row refetch
   - table refresh
   - manual entry lookup
3. `useAwsRefetch` owns UI orchestration, loading flags, password-challenge resume, and notifier calls.

This keeps AWS I/O, table mutation, and UI state from collapsing back into one file.

## Storage and migrations

- `storage.ts` is the only module that knows IndexedDB/localStorage wire formats.
- Config, snapshot, and refresh-job envelopes are schema-versioned independently.
- Legacy cache/config payloads are upgraded through explicit migration helpers before use.
- Domain normalization still happens after cache restore, but migration owns envelope/version changes first.

## Adding features

- Add a new validation rule:
  - define or update the rule in `app/lib/rules/catalog.ts`
  - implement table-specific logic under `app/lib/rules/evaluators/*`
  - add fixture/unit coverage near the affected domain files
- Add a new dashboard action:
  - low-level technical call in `app/lib/*`
  - orchestration in `app/features/dashboard/hooks/*`
  - keep user-facing strings in presenter/controller code, not low-level modules
- Add a new screen:
  - compose it in `app/features/dashboard`
  - avoid mixing domain transforms into layout files

## Worker contracts

Worker message contracts live in shared modules under `app/lib/workers`.

Current contracts:

- `backup-view-contract.ts`: shared by the analyzer UI and the backup view worker
- `backup-source-contract.ts`: shared by the backup loader UI path and the backup source worker

Workers should not define ad hoc message shapes inline.

Current worker guarantees:

- backup-source requests and responses carry a `requestId`
- backup-source failures carry a typed `errorCode`
- controller hooks ignore stale backup-source worker responses that do not match the current request

## Guardrails

- Direct imports from `app/lib/storage.ts` are allowed only inside repository modules and storage tests.
- `sonner` is allowed only in controller hooks and layout wiring.
- Large feature files are capped by ESLint line-count limits to slow regression toward god-components.
- Controller hooks should orchestrate one major async feature area, not become mini-applications.
- Domain modules should not mix parsing, migration, and presentation responsibilities in one file.
- UI files should render projections they receive, not recompute domain state inline.

## CI

CI runs:

- lint
- typecheck
- unit tests
- fixture-based web e2e

Real-token e2e remains opt-in and is not the default CI foundation.

The existing deploy workflow is also the only CI workflow. Pull requests run checks only; deploy jobs are skipped outside eligible push/manual runs.

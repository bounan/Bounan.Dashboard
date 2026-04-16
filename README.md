# Bounan.Dashboard

Static dashboard for validating GitHub backup snapshots and refetching individual DynamoDB rows through browser-safe AWS Cognito credentials.

## Apps

- `apps/web`: Next.js static export frontend. No backend API routes.
- `apps/infra`: AWS CDK app that provisions Cognito and read-only DynamoDB access for the dashboard.

## Web app

### How the dashboard works

1. The user enters GitHub and optional Cognito settings on `Main Config`.
2. `Check` validates access only. It does not fetch backup data.
3. `Backup` loads root `*.jsonl` files from GitHub in a worker, normalizes them, applies rules, and caches the snapshot in IndexedDB.
4. If AWS Cognito is configured, the dashboard enriches table identity with real DynamoDB key schema and can refetch individual entries from the browser.
5. `Rules` is derived from the loaded backup snapshot and shows grouped violations plus entry-level update actions.

### Data flow

1. GitHub worker fetches root `*.jsonl` files from the configured backup repo.
2. Parsed records are normalized into table rows and structural issues.
3. Rule engine evaluates normalized tables and emits rule findings and violation summaries.
4. The validated snapshot is cached in IndexedDB and the small config is stored in `localStorage`.
5. Backup and Rules screens render derived projections from the cached snapshot.
6. Optional AWS recovery actions load live DynamoDB data and rerun validation against the updated tables.

### Identity model

- `row.id` is a UI/render key.
- `rowIdentityKey` is the canonical business identity for schema-backed rows.
- heuristic-only rows are browseable, but identity-dependent actions stay blocked until schema-backed identity is available.

### Test layers

- unit tests cover domain logic, normalization, validation, and worker contracts
- fixture e2e covers the normal browser flow without live credentials
- real-token e2e remains opt-in for manual GitHub validation

### Main screens

- `Main Config`
  - Stores GitHub and Cognito settings in browser storage.
  - Imports and exports JSON config files.
  - `Check` only validates GitHub repository access.
  - Does not fetch backup content.
- `Backup`
  - Loads root-level `*.jsonl` backup tables from the configured GitHub repo.
  - Parses, validates, caches, and displays table data.
  - Shows backup version metadata and allows manual refresh.
  - Allows refetching the selected row directly from DynamoDB through Cognito.
- `Rules`
  - Displays the validation rules and aggregated violations.

### Storage model

- Small config values are stored in `localStorage`.
- Loaded backup snapshots are stored in IndexedDB.
- All network requests are performed from the browser. Heavy backup loading work runs in a worker.

### AWS recovery flow

1. Cognito credentials are entered on `Main Config` and checked manually.
2. Backup tables are loaded from GitHub as the base snapshot.
3. If AWS settings are present, DynamoDB key schema can enrich row identity.
4. The Backup screen can:
   - refresh a whole table from DynamoDB
   - refetch a selected row
   - load a row by manually entered key fields even when it is missing from the snapshot
5. After a live AWS action, validations are rerun and the updated snapshot is written back to IndexedDB.

### Where to change things

- Add a new validation rule:
  - rule definitions and descriptions live under `apps/web/app/lib/rules`
  - table-family evaluators live under `apps/web/app/lib/rules/evaluators`
- Add a new backup/AWS action:
  - controller wiring lives under `apps/web/app/features/dashboard/hooks`
  - focused AWS action modules live under `apps/web/app/features/dashboard/hooks/aws-actions`
- Add or change a main screen:
  - screen composition lives under `apps/web/app/features/dashboard`
  - reusable UI primitives live under `apps/web/app/components/ui`

## AWS infra

`apps/infra` provisions the minimum auth stack required for browser-side DynamoDB reads:

- Cognito User Pool
- Cognito User Pool Client
- Cognito Identity Pool
- `dashboard-readers` User Pool group
- IAM role with read-only access to the configured DynamoDB table prefixes

### CDK outputs

The stack emits these values:

- `AwsRegion`
- `CognitoUserPoolId`
- `CognitoUserPoolClientId`
- `CognitoIdentityPoolId`
- `ReaderGroupName`
- `DashboardWebConfig`

`DashboardWebConfig` is a JSON string intended for direct import into the web app config screen.
Create users manually and add them to the emitted reader group.

## Commands

### Web

- `pnpm --filter web run lint`
- `pnpm --filter web run check-types`
- `pnpm --filter web run build`
- `pnpm --filter e2e run test:e2e`

### Infra

- `pnpm --filter infra run lint`
- `pnpm --filter infra run check-types`
- `pnpm --filter infra run synth`

## Notes

- GitHub access works from the browser because GitHub API supports CORS for authenticated requests.
- AWS access must use browser-safe credentials. This project uses Cognito plus an Identity Pool instead of long-lived AWS secrets.
- The dashboard is intentionally frontend-only and suitable for static hosting.
- The existing GitHub Actions workflow runs lint, typecheck, unit tests, and fixture e2e before deploy jobs proceed.

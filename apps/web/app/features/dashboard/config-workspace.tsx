"use client";

import { Download, FileUp, Save, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import type { BackupConfig } from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { ConfigField } from "./config-field";
import { DashboardHeroSection } from "./dashboard-shell";
import type { ConfigWorkspaceProps } from "./config-workspace.types";

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{
    key: keyof Pick<
      BackupConfig,
      | "githubToken"
      | "backupRepo"
      | "awsRegion"
      | "cognitoUserPoolId"
      | "cognitoUserPoolClientId"
      | "cognitoIdentityPoolId"
      | "cognitoUsername"
      | "cognitoPassword"
    >;
    label: string;
    placeholder: string;
    helper?: string;
    multiline?: boolean;
  }>;
}> = [
  {
    title: "GitHub source",
    description: "Define the repository and token used for static backup loading.",
    fields: [
      {
        key: "backupRepo",
        label: "Backup repo",
        placeholder: "owner/repo",
        helper:
          "Manual validation checks GitHub access only. Backup loading stays on the Backup page.",
      },
      {
        key: "githubToken",
        label: "GitHub token",
        placeholder: "github_pat_...",
        helper: "Stored locally in this browser.",
        multiline: true,
      },
    ],
  },
  {
    title: "AWS recovery",
    description: "Optional Cognito-backed access for live DynamoDB row and table recovery.",
    fields: [
      { key: "awsRegion", label: "AWS region", placeholder: "eu-central-1" },
      { key: "cognitoUsername", label: "Cognito username", placeholder: "dashboard-user" },
      {
        key: "cognitoPassword",
        label: "Cognito password",
        placeholder: "Permanent password",
        multiline: true,
      },
      { key: "cognitoUserPoolId", label: "User Pool ID", placeholder: "eu-central-1_xxxx" },
      { key: "cognitoUserPoolClientId", label: "User Pool Client ID", placeholder: "client-id" },
      { key: "cognitoIdentityPoolId", label: "Identity Pool ID", placeholder: "region:uuid" },
    ],
  },
];

export function ConfigWorkspace(props: ConfigWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validationBadgeVariant =
    props.validationState.kind === "valid"
      ? "success"
      : props.validationState.kind === "invalid"
        ? "destructive"
        : "secondary";
  const validationBadgeLabel =
    props.validationState.kind === "valid"
      ? "verified"
      : props.validationState.kind === "invalid"
        ? "attention"
        : "not checked";
  const validationAlertVariant =
    props.validationState.kind === "valid"
      ? "success"
      : props.validationState.kind === "invalid"
        ? "warning"
        : "default";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <DashboardHeroSection
        badge="Config"
        title="Configuration only, no hidden backup work"
        description="This screen stores credentials locally, imports and exports JSON, and runs manual access checks. Backup fetches, versions, and data refresh stay on the Backup page."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];

                if (file) {
                  void props.onImport(file);
                }

                event.currentTarget.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Import JSON
            </Button>
            <Button variant="secondary" onClick={props.onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button variant="secondary" onClick={() => void props.onValidate()}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Check
            </Button>
            <Button onClick={props.onSave}>
              <Save className="mr-2 h-4 w-4" />
              Save config
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {fieldGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <ConfigField
                      key={field.key}
                      id={field.key}
                      label={field.label}
                      value={props.config[field.key]}
                      placeholder={field.placeholder}
                      helper={field.helper}
                      multiline={field.multiline}
                      onChange={(value) => props.onChange(field.key, value)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation state</CardTitle>
              <CardDescription>Checks are manual. Import only fills fields.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">GitHub access</span>
                <Badge variant={validationBadgeVariant}>{validationBadgeLabel}</Badge>
              </div>
              {props.validationState.message ? (
                <Alert variant={validationAlertVariant}>
                  <AlertTitle>
                    {props.validationState.kind === "valid"
                      ? "Validation complete"
                      : props.validationState.kind === "info"
                        ? "Import complete"
                        : "Validation summary"}
                  </AlertTitle>
                  <AlertDescription>{props.validationState.message}</AlertDescription>
                </Alert>
              ) : null}
              {props.source?.ok ? (
                <Alert variant="success">
                  <AlertTitle>GitHub access verified</AlertTitle>
                  <AlertDescription>
                    Access to the configured repository is valid. Backup loading and refresh actions
                    stay on the Backup page.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stored locally</CardTitle>
              <CardDescription>
                These values persist in browser storage on this machine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Repo</span>
                  <span className="font-medium text-slate-100">
                    {props.config.backupRepo || "n/a"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">GitHub token</span>
                  <span className="font-medium text-slate-100">
                    {props.config.githubToken
                      ? `${props.config.githubToken.slice(0, 8)}...`
                      : "empty"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">AWS region</span>
                  <span className="font-medium text-slate-100">
                    {props.config.awsRegion || "n/a"}
                  </span>
                </div>
              </div>
              <Separator />
              {props.saveMessage ? (
                <p className="text-sm text-slate-400">{props.saveMessage}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

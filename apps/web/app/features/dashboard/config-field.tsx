"use client";

import type { BackupConfig } from "../../lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export function ConfigField(props: {
  id: keyof Pick<
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
  value: string;
  placeholder: string;
  helper?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={props.multiline ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.multiline ? (
        <Textarea
          id={props.id}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
          placeholder={props.placeholder}
        />
      ) : (
        <Input
          id={props.id}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
          placeholder={props.placeholder}
        />
      )}
      {props.helper ? <p className="text-sm text-slate-500">{props.helper}</p> : null}
    </div>
  );
}

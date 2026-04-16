"use client";

export type ConfigValidationState =
  | { kind: "unchecked"; message: null }
  | { kind: "info"; message: string }
  | { kind: "valid"; message: string }
  | { kind: "invalid"; message: string };

export const uncheckedConfigValidationState: ConfigValidationState = {
  kind: "unchecked",
  message: null,
};

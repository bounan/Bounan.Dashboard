"use client";

export function normalizeUnmarshalledDynamoValue(value: unknown): unknown {
  if (value instanceof Set) {
    return [...value].map((item) => normalizeUnmarshalledDynamoValue(item));
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnmarshalledDynamoValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeUnmarshalledDynamoValue(nested)]),
    );
  }

  return value;
}

export function normalizeUnmarshalledDynamoRecord(value: Record<string, unknown>) {
  return normalizeUnmarshalledDynamoValue(value) as Record<string, unknown>;
}

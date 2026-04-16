type DynamoAttribute =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { NULL: boolean }
  | { M: Record<string, DynamoAttribute> }
  | { L: DynamoAttribute[] }
  | { SS: string[] }
  | { NS: string[] };

function isAttributeWrapper(value: unknown): value is DynamoAttribute {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.length === 1 && ["S", "N", "BOOL", "NULL", "M", "L", "SS", "NS"].includes(keys[0]!);
}

function decodeAttribute(value: DynamoAttribute): unknown {
  if ("S" in value) {
    return value.S;
  }

  if ("N" in value) {
    return Number(value.N);
  }

  if ("BOOL" in value) {
    return value.BOOL;
  }

  if ("NULL" in value) {
    return null;
  }

  if ("SS" in value) {
    return value.SS;
  }

  if ("NS" in value) {
    return value.NS.map((item) => Number(item));
  }

  if ("L" in value) {
    return value.L.map(decodeAttribute);
  }

  return Object.fromEntries(
    Object.entries(value.M).map(([key, nested]) => [key, decodeAttribute(nested)]),
  );
}

export function decodeDynamoRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value };
  }

  const record = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.entries(record).map(([key, fieldValue]) => [
      key,
      isAttributeWrapper(fieldValue) ? decodeAttribute(fieldValue) : fieldValue,
    ]),
  );
}

import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { detectPrimaryKeys, parseJsonlDocument } from "./github-browser";

describe("parseJsonlDocument", () => {
  it("parses non-empty JSONL rows and skips blank lines", () => {
    const rows = parseJsonlDocument('{"id":"a"}\n\n{"id":"b","enabled":true}\n');

    expect(rows).toEqual([{ id: "a" }, { id: "b", enabled: true }]);
  });

  it("throws a typed parse error for malformed JSONL", () => {
    expect(() => parseJsonlDocument('{"id":"a"}\n{"id": }\n')).toThrowError(AppError);
    expect(() => parseJsonlDocument('{"id":"a"}\n{"id": }\n')).toThrow(/line 2/i);
  });
});

describe("detectPrimaryKeys", () => {
  it("prefers stable high-cardinality key fields", () => {
    const result = detectPrimaryKeys([
      { primaryKey: "pk-1", sortKey: "one", status: "ready" },
      { primaryKey: "pk-2", sortKey: "two", status: "ready" },
      { primaryKey: "pk-3", sortKey: "three", status: "ready" },
    ]);

    expect(result).toEqual(["primaryKey", "sortKey"]);
  });

  it("falls back to derived id for empty tables", () => {
    expect(detectPrimaryKeys([])).toEqual(["derived-id"]);
  });
});

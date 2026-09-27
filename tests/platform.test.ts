import { describe, expect, test } from "bun:test";

import type { D1Database } from "@cloudflare/workers-types";

import { redactSensitive } from "../apps/server/src/services/logger";
import {
  createR2FileStorage,
  uploadWithCompensation,
} from "../apps/server/src/services/storage";
import type { FileStorage } from "../apps/server/src/services/storage";
import {
  D1_HARD_MAX_BOUND_PARAMS,
  D1_SAFE_MAX_BOUND_PARAMS,
  calculateRowsPerChunk,
  chunkByParameterBudget,
  chunkUniqueIds,
  createAtomicBatchExecutor,
} from "../packages/db/src/atomic-batch";

describe("D1 foundation helpers", () => {
  test("keeps the safe budget below the platform hard limit", () => {
    expect(D1_SAFE_MAX_BOUND_PARAMS).toBe(80);
    expect(D1_HARD_MAX_BOUND_PARAMS).toBe(100);
    expect(calculateRowsPerChunk({ parametersPerRow: 12 })).toBe(6);
  });

  test("chunks rows and de-duplicates ids deterministically", () => {
    expect(
      chunkByParameterBudget([1, 2, 3, 4, 5], { parametersPerRow: 2 })
    ).toEqual([[1, 2, 3, 4, 5]]);
    expect(chunkUniqueIds(["a", "a", "b"], 79)).toEqual([["a"], ["b"]]);
  });

  test("passes a bounded statement list to D1 batch", async () => {
    const calls: number[] = [];
    const database = {
      batch: (statements: readonly unknown[]) => {
        calls.push(statements.length);
        return Promise.resolve([]);
      },
    } as unknown as D1Database;
    const executor = createAtomicBatchExecutor(database);

    await executor.execute([{}, {}] as never);

    expect(calls).toEqual([2]);
  });
});

describe("server safety helpers", () => {
  test("redacts authentication, file, and location values", () => {
    expect(
      redactSensitive({
        authorization: "Bearer secret",
        latitude: -6.2,
        nested: { password: "temporary" },
        title: "Aman untuk dicatat",
      })
    ).toEqual({
      authorization: "[REDACTED]",
      latitude: "[REDACTED]",
      nested: { password: "[REDACTED]" },
      title: "Aman untuk dicatat",
    });
  });

  test("removes an uploaded object when metadata commit fails", async () => {
    const deletedKeys: string[] = [];
    const storage: FileStorage = {
      delete: (key) => {
        deletedKeys.push(key);
        return Promise.resolve();
      },
      get: () => Promise.resolve(null),
      put: () => Promise.resolve({} as R2Object),
    };

    await expect(
      uploadWithCompensation(storage, "imports/job/object", "data", () =>
        Promise.reject(new Error("commit failed"))
      )
    ).rejects.toThrow("commit failed");
    expect(deletedKeys).toEqual(["imports/job/object"]);
  });

  test("wraps an R2 bucket behind the storage contract", async () => {
    const bucket = {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      put: () => Promise.resolve({} as R2Object),
    } as unknown as R2Bucket;
    const storage = createR2FileStorage(bucket);

    await storage.delete("object");
    expect(await storage.get("object")).toBeNull();
  });
});

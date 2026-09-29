import { describe, expect, test } from "bun:test";

import { createUuidV7 } from "../packages/uuid/src/index";

describe("UUIDv7 generator", () => {
  test("creates RFC 9562 version 7 UUIDs", () => {
    const uuid = createUuidV7();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
  });

  test("creates unique UUIDs", () => {
    const uuids = new Set(Array.from({ length: 100 }, () => createUuidV7()));

    expect(uuids).toHaveLength(100);
  });
});

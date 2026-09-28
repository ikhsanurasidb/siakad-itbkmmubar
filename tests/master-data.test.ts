import { describe, expect, test } from "bun:test";

import {
  MASTER_DATA_TEMPLATE_VERSION,
  MasterDataDomainError,
  assertHeaders,
  assertTemplateVersion,
  normalizeCode,
  normalizeIdentifierValue,
  normalizeStudyProgramDegree,
  parseCoordinate,
  parseCsv,
  parseCsvRow,
} from "../packages/api/src/master-data";

describe("SIAKAD-02 master data rules", () => {
  test("normalizes whitespace and case for official codes", () => {
    expect(normalizeCode("  ti  ")).toBe("TI");
    expect(normalizeIdentifierValue(" nim1 ", "NIM")).toBe("NIM1");
  });

  test("limits study program degrees to S1, S2, and S3", () => {
    expect(normalizeStudyProgramDegree(" s2 ")).toBe("S2");
    expect(() => normalizeStudyProgramDegree("D3")).toThrow(
      "Jenjang hanya boleh S1, S2, atau S3"
    );
  });

  test("accepts coordinate boundaries and rejects values outside them", () => {
    expect(parseCoordinate("-90", "latitude")).toBe(-90);
    expect(parseCoordinate("180", "longitude")).toBe(180);
    expect(() => parseCoordinate("90.01", "latitude")).toThrow(
      "latitude harus berada"
    );
    expect(() => parseCoordinate("-180.01", "longitude")).toThrow(
      "longitude harus berada"
    );
  });

  test("rejects a template that tries to provide server-issued DSN", () => {
    expect(() => assertHeaders("LECTURER", ["name", "dsn", "email"])).toThrow(
      MasterDataDomainError
    );
  });

  test("requires the current template version and required headers", () => {
    expect(() => assertTemplateVersion("0")).toThrow(
      "Versi template tidak didukung"
    );
    expect(() =>
      assertHeaders("ROOM", ["code", "name", "capacity", "latitude"])
    ).toThrow("Header template tidak lengkap");
    expect(MASTER_DATA_TEMPLATE_VERSION).toBe("1");
  });

  test("parses CSV rows and preserves field positions", () => {
    const rows = [...parseCsv('code,name\nR-1,"Ruang, Utama"')];
    expect(rows).toEqual([
      ["code", "name"],
      ["R-1", "Ruang, Utama"],
    ]);
    expect(parseCsvRow(rows[0] ?? [], rows[1] ?? [])).toEqual({
      code: "R-1",
      name: "Ruang, Utama",
    });
  });
});

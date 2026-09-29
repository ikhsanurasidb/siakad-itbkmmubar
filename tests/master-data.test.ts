import { describe, expect, test } from "bun:test";

import { createMasterDataService } from "../apps/server/src/services/master-data";
import {
  MASTER_DATA_TEMPLATE_VERSION,
  MasterDataDomainError,
  assertHeaders,
  assertTemplateVersion,
  formatAcademicPeriodTerm,
  normalizeCode,
  normalizeIdentifierValue,
  normalizeStudyProgramDegree,
  parseAcademicPeriodDate,
  parseCoordinate,
  parseCsv,
  parseCsvRow,
} from "../packages/api/src/master-data";
import {
  identifierUsages,
  studyPrograms,
} from "../packages/db/src/schema/master-data";
import { auditLogs } from "../packages/db/src/schema/platform";

const createMasterDataTestDatabase = () => {
  const studyProgram = {
    archivedAt: null,
    code: "TI",
    createdAt: new Date("2026-09-28T00:00:00.000Z"),
    degree: "S1",
    id: "program-1",
    name: "Teknik Informatika",
    status: "ACTIVE",
    updatedAt: new Date("2026-09-28T00:00:00.000Z"),
    version: 1,
  };
  const rows = new Map<object, Record<string, unknown>[]>([
    [auditLogs, []],
    [identifierUsages, []],
    [studyPrograms, [studyProgram]],
  ]);

  const createBuilder = () => {
    let selectedRows: Record<string, unknown>[] = [];
    let updateTable: object | null = null;
    let updateValues: Record<string, unknown> | null = null;
    const builder = {
      from(table: object) {
        selectedRows = rows.get(table) ?? [];
        return builder;
      },
      limit(limit: number) {
        selectedRows = selectedRows.slice(0, limit);
        return builder;
      },
      offset(offset: number) {
        selectedRows = selectedRows.slice(offset);
        return builder;
      },
      orderBy() {
        return builder;
      },
      returning() {
        const tableRows = rows.get(updateTable ?? studyPrograms) ?? [];
        const [row] = tableRows;
        if (row && updateValues) {
          for (const [key, value] of Object.entries(updateValues)) {
            row[key] = key === "version" ? Number(row[key]) + 1 : value;
          }
        }
        selectedRows = row ? [row] : [];
        return builder;
      },
      set(values: Record<string, unknown>) {
        updateValues = values;
        return builder;
      },
      // eslint-disable-next-line unicorn/no-thenable
      then<TResult1 = Record<string, unknown>[], TResult2 = never>(
        onfulfilled?:
          | ((
              value: Record<string, unknown>[]
            ) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null
      ) {
        return Promise.resolve(selectedRows).then(onfulfilled, onrejected);
      },
      update(table: object) {
        updateTable = table;
        return builder;
      },
      values(value: Record<string, unknown>) {
        const tableRows = rows.get(updateTable ?? auditLogs) ?? [];
        tableRows.push(value);
        rows.set(updateTable ?? auditLogs, tableRows);
        return Promise.resolve();
      },
      where() {
        return builder;
      },
    };
    return builder;
  };

  return {
    database: {
      insert: (table: object) => {
        const builder = createBuilder();
        builder.update(table);
        return builder;
      },
      select: () => createBuilder(),
      update: (table: object) => {
        const builder = createBuilder();
        builder.update(table);
        return builder;
      },
    },
    rows,
  };
};

describe("SIAKAD-02 master data rules", () => {
  test("returns detail version, increments it, and audits before/after", async () => {
    const { database, rows } = createMasterDataTestDatabase();
    const service = createMasterDataService({
      database: database as never,
      now: () => new Date("2026-09-28T01:00:00.000Z"),
    });

    const detail = await service.get({
      entityType: "STUDY_PROGRAM",
      id: "program-1",
    });
    expect(detail.version).toBe(1);

    const updated = await service.update({
      actorUserId: "admin-1",
      data: { name: "Teknik Informatika Terapan" },
      entityType: "STUDY_PROGRAM",
      expectedVersion: 1,
      id: "program-1",
    });
    expect(updated.name).toBe("Teknik Informatika Terapan");
    expect(updated.version).toBe(2);

    const auditRows = rows.get(auditLogs) ?? [];
    expect(auditRows).toHaveLength(1);
    expect(JSON.parse(String(auditRows[0]?.beforeState))).toMatchObject({
      name: "Teknik Informatika",
      version: 1,
    });
    expect(JSON.parse(String(auditRows[0]?.afterState))).toMatchObject({
      name: "Teknik Informatika Terapan",
      version: 2,
    });
  });

  test("rejects a stale master-data update with a dedicated conflict", async () => {
    const { database, rows } = createMasterDataTestDatabase();
    const service = createMasterDataService({ database: database as never });

    await service.update({
      actorUserId: "admin-1",
      data: { name: "Nama Baru" },
      entityType: "STUDY_PROGRAM",
      expectedVersion: 1,
      id: "program-1",
    });

    await expect(
      service.update({
        actorUserId: "admin-2",
        data: { name: "Nama Lama Menimpa" },
        entityType: "STUDY_PROGRAM",
        expectedVersion: 1,
        id: "program-1",
      })
    ).rejects.toMatchObject({
      code: "MASTER_DATA_VERSION_CONFLICT",
      details: { actualVersion: 2, expectedVersion: 1 },
    });
    expect(rows.get(auditLogs)).toHaveLength(1);
  });

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

  test("localizes academic period terms and includes the end date", () => {
    expect(formatAcademicPeriodTerm("ODD")).toBe("Ganjil");
    expect(formatAcademicPeriodTerm("EVEN")).toBe("Genap");

    const endDate = parseAcademicPeriodDate(
      "2026-09-30",
      "Tanggal akhir",
      "end"
    );
    expect(endDate.toISOString()).toBe("2026-09-30T23:59:59.999Z");
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

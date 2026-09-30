/* eslint-disable complexity, no-await-in-loop, no-nested-ternary, no-shadow, prefer-destructuring */

import { seedSuperadmin } from "@server/services/bootstrap";
import { parseLocalDateTime } from "@siakad-itbkmmubar/api/time-zone";
import type { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";
import {
  attendanceAdjustments,
  attendanceCaptureAttempts,
  attendanceEvidences,
  attendanceGenerationJobs,
  attendanceRecords,
  attendanceRequests,
  attendanceReviewLogs,
  attendanceSessions,
} from "@siakad-itbkmmubar/db/schema/attendance";
import { account, user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  courseAssessmentDefaults,
  curriculumAssessmentOverrides,
  curriculumCourses,
  curriculumDocuments,
  curricula,
} from "@siakad-itbkmmubar/db/schema/curriculum";
import {
  classGradeComponents,
  finalGradeSnapshots,
  gradeAdjustments,
  gradePublications,
  gradeSubmissionBatches,
  studentComponentScores,
  studyResultSnapshots,
  transcriptEntries,
} from "@siakad-itbkmmubar/db/schema/grades";
import {
  identityAccounts,
  programHeads,
  securityEvents,
  userRoles,
  userScopes,
} from "@siakad-itbkmmubar/db/schema/identity";
import {
  assignmentFiles,
  assignmentSubmissions,
  assignments,
  forumAttachments,
  forumPosts,
  forumThreads,
  learningMaterials,
  materialFiles,
  submissionFiles,
} from "@siakad-itbkmmubar/db/schema/lms";
import {
  academicPeriods,
  academicYears,
  cohorts,
  courses,
  importJobs,
  importRows,
  lecturers,
  identifierUsages,
  rooms,
  students,
  studyPrograms,
} from "@siakad-itbkmmubar/db/schema/master-data";
import {
  auditLogs,
  backgroundJobs,
  fileObjects,
  idempotencyKeys,
  notifications,
  outboxEvents,
} from "@siakad-itbkmmubar/db/schema/platform";
import {
  classEnrollments,
  classMappingJobs,
  classMeetings,
  classSections,
  examSchedules,
  lecturerAvailabilities,
  scheduleApprovals,
  scheduleChangeRequests,
  scheduleConflicts,
  scheduleDrafts,
  scheduleRevisions,
  scheduleSlots,
  teachingAssignments,
} from "@siakad-itbkmmubar/db/schema/scheduling";
import {
  gradeScaleEntries,
  gradeScaleSets,
  policyActivationHistories,
  settingDefinitions,
  settingValues,
  settingVersions,
} from "@siakad-itbkmmubar/db/schema/settings";
import {
  studyPlanGenerationJobs,
  studyPlanHistories,
  studyPlanItems,
  studyPlans,
} from "@siakad-itbkmmubar/db/schema/study-plan";
import { and, eq } from "drizzle-orm";

const MINIMUM_PASSWORD_LENGTH = 16;
const SEED_PREFIX = "seed-2026-";
const CURRENT_PERIOD_ID = `${SEED_PREFIX}period-2026-2027-odd`;

export class DataSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSeedError";
  }
}

export interface SeedDataInput {
  password: string;
}

export interface SeedDataResult {
  accountCount: number;
  courseCount: number;
  lecturerCount: number;
  programCount: number;
  studentCount: number;
  identifiers: readonly string[];
}

const chunks = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const plusDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const checksumFor = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const gradeForScore = (
  scoreHundredths: number
): { code: string; point: number } => {
  const score = scoreHundredths / 100;
  if (score >= 85) {
    return { code: "A", point: 400 };
  }
  if (score >= 80) {
    return { code: "AB", point: 350 };
  }
  if (score >= 75) {
    return { code: "B", point: 300 };
  }
  if (score >= 70) {
    return { code: "BC", point: 250 };
  }
  if (score >= 65) {
    return { code: "C", point: 200 };
  }
  if (score >= 50) {
    return { code: "D", point: 100 };
  }
  return { code: "E", point: 0 };
};

const programDefinitions = [
  {
    code: "KWU",
    id: `${SEED_PREFIX}program-kewirausahaan`,
    name: "Kewirausahaan",
  },
  {
    code: "TS",
    id: `${SEED_PREFIX}program-teknik-sipil`,
    name: "Teknik Sipil",
  },
] as const;

const courseDefinitions = [
  [
    ["KWU101", "Pengantar Kewirausahaan", 3, 1],
    ["KWU102", "Ekonomi Mikro untuk Bisnis", 3, 1],
    ["KWU201", "Akuntansi dan Keuangan Usaha", 3, 2],
    ["KWU202", "Perilaku Organisasi", 3, 2],
    ["KWU301", "Manajemen Pemasaran", 3, 3],
    ["KWU302", "Metode Penelitian Bisnis", 3, 3],
    ["KWU401", "Manajemen Operasional", 3, 4],
    ["KWU402", "Perencanaan dan Pengembangan Produk", 3, 4],
    ["KWU501", "Perencanaan Bisnis", 3, 5],
    ["KWU502", "Manajemen Sumber Daya Manusia", 3, 5],
    ["KWU601", "Kewirausahaan Digital", 3, 6],
    ["KWU602", "Analisis Kelayakan Usaha", 3, 6],
    ["KWU701", "Manajemen Strategis", 3, 7],
    ["KWU702", "Etika Bisnis dan Keberlanjutan", 2, 7],
    ["KWU801", "Seminar Kewirausahaan", 2, 8],
    ["KWU802", "Tugas Akhir", 6, 8],
  ],
  [
    ["TS101", "Matematika Dasar", 3, 1],
    ["TS102", "Fisika Dasar", 3, 1],
    ["TS201", "Mekanika Teknik I", 3, 2],
    ["TS202", "Menggambar Teknik", 3, 2],
    ["TS301", "Mekanika Bahan", 3, 3],
    ["TS302", "Hidrologi", 3, 3],
    ["TS401", "Analisis Struktur I", 3, 4],
    ["TS402", "Teknik Pondasi", 3, 4],
    ["TS501", "Manajemen Konstruksi", 3, 5],
    ["TS502", "Rekayasa Jalan Raya", 3, 5],
    ["TS601", "Struktur Beton Bertulang", 3, 6],
    ["TS602", "Perencanaan Drainase", 3, 6],
    ["TS701", "Struktur Baja", 3, 7],
    ["TS702", "Keselamatan Konstruksi", 2, 7],
    ["TS801", "Seminar Teknik Sipil", 2, 8],
    ["TS802", "Tugas Akhir", 6, 8],
  ],
] as const;

const lecturerDefinitions = [
  {
    code: "KWU-01",
    email: "rina.kurniawati@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-rina-kurniawati`,
    name: "Dr. Rina Kurniawati, S.E., M.M.",
    nidn: "0012087801",
    phone: "+6281210011001",
    programIndex: 0,
  },
  {
    code: "KWU-02",
    email: "arief.maulana@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-arief-maulana`,
    name: "Arief Maulana, S.E., M.B.A.",
    nidn: "0021048202",
    phone: "+6281210011002",
    programIndex: 0,
  },
  {
    code: "KWU-03",
    email: "sari.novitasari@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-sari-novitasari`,
    name: "Sari Novitasari, S.E., M.M.",
    nidn: "0015118503",
    phone: "+6281210011003",
    programIndex: 0,
  },
  {
    code: "TS-01",
    email: "budi.santoso@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-budi-santoso`,
    name: "Dr. Budi Santoso, S.T., M.T.",
    nidn: "0015037604",
    phone: "+6281210011004",
    programIndex: 1,
  },
  {
    code: "TS-02",
    email: "dewi.lestari@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-dewi-lestari`,
    name: "Dewi Lestari, S.T., M.Eng.",
    nidn: "0022078105",
    phone: "+6281210011005",
    programIndex: 1,
  },
  {
    code: "TS-03",
    email: "yusuf.hakim@akademika.ac.id",
    id: `${SEED_PREFIX}lecturer-yusuf-hakim`,
    name: "Yusuf Hakim, S.T., M.T.",
    nidn: "0019098406",
    phone: "+6281210011006",
    programIndex: 1,
  },
] as const;

const roomDefinitions = [
  {
    capacity: 40,
    code: "GKB-A201",
    id: `${SEED_PREFIX}room-gkb-a201`,
    latitude: -6.914744,
    longitude: 107.60981,
    name: "Ruang Kuliah GKB A201",
  },
  {
    capacity: 36,
    code: "GKB-A202",
    id: `${SEED_PREFIX}room-gkb-a202`,
    latitude: -6.91468,
    longitude: 107.60992,
    name: "Ruang Kuliah GKB A202",
  },
  {
    capacity: 24,
    code: "LAB-B301",
    id: `${SEED_PREFIX}room-lab-b301`,
    latitude: -6.91453,
    longitude: 107.61012,
    name: "Laboratorium Komputasi B301",
  },
  {
    capacity: 48,
    code: "GKB-C101",
    id: `${SEED_PREFIX}room-gkb-c101`,
    latitude: -6.91488,
    longitude: 107.61025,
    name: "Ruang Kuliah GKB C101",
  },
  {
    capacity: 30,
    code: "LAB-STR-D102",
    id: `${SEED_PREFIX}room-lab-str-d102`,
    latitude: -6.91504,
    longitude: 107.61042,
    name: "Laboratorium Struktur D102",
  },
  {
    capacity: 20,
    code: "STUDIO-E201",
    id: `${SEED_PREFIX}room-studio-e201`,
    latitude: -6.91521,
    longitude: 107.61002,
    name: "Studio Perancangan E201",
  },
] as const;

const studentNames = [
  [
    "Aulia Rahmawati",
    "Bagas Pratama",
    "Citra Lestari",
    "Dimas Saputra",
    "Eka Puspita",
    "Fajar Nugroho",
    "Gita Permata",
    "Hendra Wijaya",
    "Intan Maharani",
  ],
  [
    "Jihan Anindita",
    "Kevin Aditya",
    "Larasati Putri",
    "M. Rizky Firmansyah",
    "Nadia Oktaviani",
    "Oki Setiawan",
    "Putri Wulandari",
    "Rafi Prakoso",
    "Salsabila Nurfadila",
  ],
] as const;

const studentPhone = (programIndex: number, sequence: number): string =>
  `+628139${String(programIndex + 1)}${String(sequence).padStart(5, "0")}`;

const buildStudentDefinitions = () =>
  programDefinitions.flatMap((program, programIndex) => {
    const names = studentNames[programIndex];
    if (!names) {
      return [];
    }
    return names.map((name, index) => {
      const cohortYear =
        index < 2 ? 2024 : index < 4 ? 2025 : index < 6 ? 2026 : 2023;
      const sequence = index + 1;
      const academicStatus =
        index === 6
          ? "GRADUATED"
          : index === 7
            ? "LEAVE"
            : index === 8
              ? "DROPPED_OUT"
              : "ACTIVE";
      return {
        academicStatus,
        cohortYear,
        email: `${name.toLowerCase().replaceAll(/[^a-z]+/gu, ".")}@mahasiswa.akademika.ac.id`,
        id: `${SEED_PREFIX}student-${program.code.toLowerCase()}-${sequence}`,
        name,
        nim: `${cohortYear}${String(programIndex + 1).padStart(2, "0")}${String(sequence).padStart(3, "0")}`,
        phone: studentPhone(programIndex, sequence),
        programIndex,
        status: index >= 6 ? (index === 7 ? "ACTIVE" : "ARCHIVED") : "ACTIVE",
      };
    });
  });

const ensureSeedUser = async ({
  auth,
  database,
  email,
  identifier,
  identityType,
  name,
  password,
  phone,
  roleKey,
  now,
}: {
  auth: ReturnType<typeof createConfiguredAuth>;
  database: Database;
  email: string;
  identifier: string;
  identityType: "ADMIN_AKADEMIK" | "ADMIN_KEUANGAN" | "DOSEN" | "MAHASISWA";
  name: string;
  password: string;
  phone: string | null;
  roleKey: "ADMIN_AKADEMIK" | "ADMIN_KEUANGAN" | "DOSEN" | "MAHASISWA";
  now: Date;
}): Promise<string> => {
  const [existingIdentity] = await database
    .select({ userId: identityAccounts.userId })
    .from(identityAccounts)
    .where(eq(identityAccounts.identifier, identifier))
    .limit(1);
  if (existingIdentity) {
    return existingIdentity.userId;
  }

  const [existingUser] = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  let resolvedUserId = existingUser?.id ?? null;
  if (!existingUser) {
    const authContext = await auth.$context;
    const createdUser = await authContext.internalAdapter.createUser(
      {
        email,
        emailVerified: true,
        name,
        username: identifier,
      },
      { method: "admin" }
    );
    resolvedUserId = createdUser.id;
    const passwordHash = await authContext.password.hash(password);
    await authContext.internalAdapter.linkAccount({
      accountId: resolvedUserId,
      password: passwordHash,
      providerId: "credential",
      userId: resolvedUserId,
    });
  } else if (existingUser) {
    const existingUserId = existingUser.id;
    resolvedUserId = existingUserId;
    const [credentialAccount] = await database
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, existingUserId),
          eq(account.providerId, "credential")
        )
      )
      .limit(1);
    if (!credentialAccount) {
      const authContext = await auth.$context;
      await authContext.internalAdapter.linkAccount({
        accountId: existingUserId,
        password: await authContext.password.hash(password),
        providerId: "credential",
        userId: existingUserId,
      });
    }
  }

  if (!resolvedUserId) {
    throw new DataSeedError(`User untuk ${identifier} tidak dapat disiapkan.`);
  }
  await database
    .insert(identityAccounts)
    .values({
      createdAt: now,
      id: `${SEED_PREFIX}identity-${identifier.toLowerCase()}`,
      identifier,
      identityType,
      mustChangePassword: false,
      phone,
      status: "ACTIVE",
      temporaryPasswordExpiresAt: null,
      updatedAt: now,
      userId: resolvedUserId,
    })
    .onConflictDoNothing();
  await database
    .insert(userRoles)
    .values({
      assignedAt: now,
      assignedBy: null,
      id: `${SEED_PREFIX}role-${identifier.toLowerCase()}-${roleKey.toLowerCase()}`,
      isActive: true,
      roleKey,
      userId: resolvedUserId,
    })
    .onConflictDoNothing();
  return resolvedUserId;
};

export const seedData = async ({
  auth,
  database,
  input,
  now = new Date(),
  timeZone,
}: {
  auth: ReturnType<typeof createConfiguredAuth>;
  database: Database;
  input: SeedDataInput;
  now?: Date;
  timeZone: string;
}): Promise<SeedDataResult> => {
  if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new DataSeedError(
      `Password seed minimal ${MINIMUM_PASSWORD_LENGTH} karakter.`
    );
  }

  const at = (value: string): Date => parseLocalDateTime(value, timeZone);

  let [superadmin] = await database
    .select({
      identifier: identityAccounts.identifier,
      userId: identityAccounts.userId,
    })
    .from(identityAccounts)
    .where(eq(identityAccounts.identityType, "SUPERADMIN"))
    .limit(1);
  if (!superadmin) {
    const [identityCount] = await database
      .select({ count: identityAccounts.id })
      .from(identityAccounts);
    if (identityCount?.count) {
      throw new DataSeedError(
        "Seed data membutuhkan akun SUPERADMIN. Jalankan seed superadmin terlebih dahulu."
      );
    }
    await seedSuperadmin({
      auth,
      database,
      input: {
        email: "superadmin@account.siakad.local",
        identifier: "SUP20260928001",
        name: "Administrator Sistem Akademik",
        password: input.password,
      },
      now,
    });
    [superadmin] = await database
      .select({
        identifier: identityAccounts.identifier,
        userId: identityAccounts.userId,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.identityType, "SUPERADMIN"))
      .limit(1);
  }
  if (!superadmin) {
    throw new DataSeedError("Akun SUPERADMIN tidak dapat disiapkan.");
  }

  await database
    .insert(userRoles)
    .values({
      assignedAt: now,
      assignedBy: superadmin.userId,
      id: `${SEED_PREFIX}role-superadmin-admin-akademik`,
      isActive: true,
      roleKey: "ADMIN_AKADEMIK",
      userId: superadmin.userId,
    })
    .onConflictDoNothing();

  const adminAcademicId = await ensureSeedUser({
    auth,
    database,
    email: "admin.akademik@akademika.ac.id",
    identifier: "AKD20260928001",
    identityType: "ADMIN_AKADEMIK",
    name: "Nina Kusumawardani, S.Ak.",
    now,
    password: input.password,
    phone: "+6281210002001",
    roleKey: "ADMIN_AKADEMIK",
  });
  const financeAdminId = await ensureSeedUser({
    auth,
    database,
    email: "admin.keuangan@akademika.ac.id",
    identifier: "KEU20260928001",
    identityType: "ADMIN_KEUANGAN",
    name: "Faisal Ramadhan, S.E.",
    now,
    password: input.password,
    phone: "+6281210002002",
    roleKey: "ADMIN_KEUANGAN",
  });

  const programs = programDefinitions.map((program) => ({
    archivedAt: null,
    code: program.code,
    createdAt: now,
    degree: "S1" as const,
    id: program.id,
    name: program.name,
    status: "ACTIVE" as const,
    updatedAt: now,
    version: 1,
  }));
  await database.insert(studyPrograms).values(programs).onConflictDoNothing();

  const cohortRows = programDefinitions.flatMap((program) =>
    [2023, 2024, 2025, 2026].map((entryYear) => ({
      createdAt: now,
      entryYear,
      id: `${program.id}-cohort-${entryYear}`,
      status: "ACTIVE" as const,
      studyProgramId: program.id,
      updatedAt: now,
      version: 1,
    }))
  );
  for (const rows of chunks(cohortRows, 8)) {
    await database.insert(cohorts).values(rows).onConflictDoNothing();
  }

  const academicYearRows = [
    { endYear: 2025, startYear: 2024 },
    { endYear: 2026, startYear: 2025 },
    { endYear: 2027, startYear: 2026 },
  ].map(({ startYear, endYear }) => ({
    code: `${startYear}/${endYear}`,
    createdAt: now,
    endYear,
    id: `${SEED_PREFIX}year-${startYear}-${endYear}`,
    startYear,
    status: "ACTIVE" as const,
    updatedAt: now,
    version: 1,
  }));
  await database
    .insert(academicYears)
    .values(academicYearRows)
    .onConflictDoNothing();

  const academicPeriodRows = [
    {
      endDate: "2025-01-31T23:59:00",
      endYear: 2025,
      startDate: "2024-08-19T07:00:00",
      startYear: 2024,
      status: "CLOSED",
      term: "ODD",
    },
    {
      endDate: "2025-07-31T23:59:00",
      endYear: 2025,
      startDate: "2025-02-10T07:00:00",
      startYear: 2024,
      status: "CLOSED",
      term: "EVEN",
    },
    {
      endDate: "2026-01-31T23:59:00",
      endYear: 2026,
      startDate: "2025-08-18T07:00:00",
      startYear: 2025,
      status: "CLOSED",
      term: "ODD",
    },
    {
      endDate: "2026-07-31T23:59:00",
      endYear: 2026,
      startDate: "2026-02-09T07:00:00",
      startYear: 2025,
      status: "CLOSED",
      term: "EVEN",
    },
    {
      endDate: "2027-01-31T23:59:00",
      endYear: 2027,
      startDate: "2026-08-17T07:00:00",
      startYear: 2026,
      status: "ACTIVE",
      term: "ODD",
    },
    {
      endDate: "2027-07-31T23:59:00",
      endYear: 2027,
      startDate: "2027-02-08T07:00:00",
      startYear: 2026,
      status: "DRAFT",
      term: "EVEN",
    },
  ].map(({ endDate, endYear, startDate, startYear, status, term }) => ({
    academicYearId: `${SEED_PREFIX}year-${startYear}-${endYear}`,
    createdAt: now,
    endDate: at(endDate),
    id: `${SEED_PREFIX}period-${startYear}-${endYear}-${String(term).toLowerCase()}`,
    startDate: at(startDate),
    status,
    term,
    updatedAt: now,
    version: 1,
  }));
  await database
    .insert(academicPeriods)
    .values(academicPeriodRows)
    .onConflictDoNothing();

  const studentDefinitions = buildStudentDefinitions();
  const studentRows = studentDefinitions.map((studentDefinition) => {
    const program = programDefinitions[studentDefinition.programIndex];
    if (!program) {
      throw new DataSeedError(
        `Program studi untuk ${studentDefinition.name} tidak ditemukan.`
      );
    }
    return {
      academicStatus: studentDefinition.academicStatus,
      archivedAt: studentDefinition.status === "ARCHIVED" ? now : null,
      cohortId: `${program.id}-cohort-${studentDefinition.cohortYear}`,
      createdAt: now,
      email: studentDefinition.email,
      id: studentDefinition.id,
      name: studentDefinition.name,
      nim: studentDefinition.nim,
      phone: studentDefinition.phone,
      provisioningStatus: "PROVISIONED" as const,
      status: studentDefinition.status,
      studyProgramId: program.id,
      updatedAt: now,
      version: 1,
    };
  });
  for (const rows of chunks(studentRows, 3)) {
    await database.insert(students).values(rows).onConflictDoNothing();
  }
  for (const rows of chunks(
    studentRows.map((student) => ({
      createdAt: now,
      entityId: student.id,
      entityType: "STUDENT",
      id: `${SEED_PREFIX}identifier-nim-${student.nim}`,
      identifier: student.nim,
      identifierType: "NIM",
      lockedAt: now,
      usageType: "MASTER_RECORD",
    })),
    8
  )) {
    await database.insert(identifierUsages).values(rows).onConflictDoNothing();
  }

  const lecturerRows = lecturerDefinitions.map((lecturer, index) => ({
    academicStatus: "ACTIVE" as const,
    archivedAt: null,
    createdAt: now,
    dsn: `DSN20260928${String(index + 1).padStart(3, "0")}`,
    email: lecturer.email,
    id: lecturer.id,
    name: lecturer.name,
    nidn: lecturer.nidn,
    nuptk: `1234567890${String(index + 1).padStart(4, "0")}`,
    phone: lecturer.phone,
    provisioningStatus: "PROVISIONED" as const,
    status: "ACTIVE" as const,
    updatedAt: now,
    version: 1,
  }));
  await database.insert(lecturers).values(lecturerRows).onConflictDoNothing();
  await database
    .insert(identifierUsages)
    .values(
      lecturerRows.flatMap((lecturer) => [
        {
          createdAt: now,
          entityId: lecturer.id,
          entityType: "LECTURER",
          id: `${SEED_PREFIX}identifier-nidn-${lecturer.nidn}`,
          identifier: lecturer.nidn,
          identifierType: "NIDN",
          lockedAt: now,
          usageType: "MASTER_RECORD",
        },
        {
          createdAt: now,
          entityId: lecturer.id,
          entityType: "LECTURER",
          id: `${SEED_PREFIX}identifier-dsn-${lecturer.dsn}`,
          identifier: lecturer.dsn,
          identifierType: "DSN",
          lockedAt: now,
          usageType: "MASTER_RECORD",
        },
      ])
    )
    .onConflictDoNothing();

  await database
    .insert(rooms)
    .values(
      roomDefinitions.map((room) => ({
        ...room,
        createdAt: now,
        status: "ACTIVE" as const,
        updatedAt: now,
        version: 1,
      }))
    )
    .onConflictDoNothing();

  const courseRows = programDefinitions.flatMap((program, programIndex) => {
    const definitions = courseDefinitions[programIndex];
    if (!definitions) {
      return [];
    }
    return definitions.map(([code, name, credits, semester]) => ({
      code,
      createdAt: now,
      credits,
      defaultSemester: semester,
      id: `${SEED_PREFIX}course-${code.toLowerCase()}`,
      name,
      status: "ACTIVE" as const,
      studyProgramId: program.id,
      updatedAt: now,
      version: 1,
    }));
  });
  for (const rows of chunks(courseRows, 6)) {
    await database.insert(courses).values(rows).onConflictDoNothing();
  }

  const authUsers = new Map<string, string>([
    ["SUPERADMIN", superadmin.userId],
    ["ADMIN_AKADEMIK", adminAcademicId],
    ["ADMIN_KEUANGAN", financeAdminId],
  ]);
  for (const [index, lecturer] of lecturerDefinitions.entries()) {
    const userId = await ensureSeedUser({
      auth,
      database,
      email: lecturer.email,
      identifier: `DSN20260928${String(index + 1).padStart(3, "0")}`,
      identityType: "DOSEN",
      name: lecturer.name,
      now,
      password: input.password,
      phone: lecturer.phone,
      roleKey: "DOSEN",
    });
    authUsers.set(lecturer.id, userId);
  }
  for (const studentDefinition of studentDefinitions.filter(
    (studentDefinition) => studentDefinition.academicStatus === "ACTIVE"
  )) {
    const userId = await ensureSeedUser({
      auth,
      database,
      email: studentDefinition.email,
      identifier: studentDefinition.nim,
      identityType: "MAHASISWA",
      name: studentDefinition.name,
      now,
      password: input.password,
      phone: studentDefinition.phone,
      roleKey: "MAHASISWA",
    });
    authUsers.set(studentDefinition.id, userId);
  }

  const kaprodiLecturers = [lecturerRows[0], lecturerRows[3]];
  for (const [programIndex, lecturer] of kaprodiLecturers.entries()) {
    if (!lecturer) {
      continue;
    }
    const lecturerUserId = authUsers.get(lecturer.id);
    const program = programDefinitions[programIndex];
    if (!(lecturerUserId && program)) {
      continue;
    }
    await database
      .insert(userRoles)
      .values({
        assignedAt: now,
        assignedBy: superadmin.userId,
        id: `${SEED_PREFIX}role-kaprodi-${program.code.toLowerCase()}`,
        isActive: true,
        roleKey: "KAPRODI",
        userId: lecturerUserId,
      })
      .onConflictDoNothing();
    await database
      .insert(programHeads)
      .values({
        assignedAt: now,
        assignedBy: superadmin.userId,
        endsAt: null,
        id: `${SEED_PREFIX}program-head-${program.code.toLowerCase()}`,
        prodiId: program.id,
        startsAt: at("2026-08-01T07:00:00"),
        userId: lecturerUserId,
      })
      .onConflictDoNothing();
    await database
      .insert(userScopes)
      .values({
        createdAt: now,
        endsAt: null,
        id: `${SEED_PREFIX}scope-kaprodi-${program.code.toLowerCase()}`,
        scopeId: program.id,
        scopeType: "PRODI",
        startsAt: at("2026-08-01T07:00:00"),
        userId: lecturerUserId,
      })
      .onConflictDoNothing();
  }

  const curriculumRows = programDefinitions.flatMap((program) =>
    [2023, 2024, 2025, 2026].map((entryYear) => ({
      activatedAt: entryYear === 2023 ? null : at("2026-08-01T07:00:00"),
      activatedBy: entryYear === 2023 ? null : superadmin.userId,
      cohortId: `${program.id}-cohort-${entryYear}`,
      createdAt: now,
      createdBy: superadmin.userId,
      id: `${SEED_PREFIX}curriculum-${program.code.toLowerCase()}-${entryYear}`,
      name: `Kurikulum ${program.name} 202${entryYear % 10}`,
      status:
        entryYear === 2023
          ? "ARCHIVED"
          : entryYear === 2026
            ? "DRAFT"
            : "ACTIVE",
      studyProgramId: program.id,
      updatedAt: now,
    }))
  );
  for (const rows of chunks(curriculumRows, 4)) {
    await database.insert(curricula).values(rows).onConflictDoNothing();
  }

  const curriculumCourseRows = curriculumRows.flatMap((curriculum) => {
    const programIndex = programDefinitions.findIndex(
      (program) => program.id === curriculum.studyProgramId
    );
    const definitions = courseDefinitions[programIndex];
    if (!definitions) {
      return [];
    }
    return definitions.map(([code, _name, credits, semester], index) => ({
      courseId: `${SEED_PREFIX}course-${code.toLowerCase()}`,
      courseType:
        index % 2 === 0 ? ("REQUIRED" as const) : ("ELECTIVE" as const),
      createdAt: now,
      credits,
      curriculumId: curriculum.id,
      id: `${curriculum.id}-course-${code.toLowerCase()}`,
      semester,
      sortOrder: index + 1,
      updatedAt: now,
    }));
  });
  for (const rows of chunks(curriculumCourseRows, 8)) {
    await database.insert(curriculumCourses).values(rows).onConflictDoNothing();
  }

  const assessmentComponents = [
    ["QUIZ", "Kuis", 15],
    ["ASSIGNMENT", "Tugas", 25],
    ["MIDTERM", "Ujian Tengah Semester", 25],
    ["FINAL", "Ujian Akhir Semester", 35],
  ] as const;
  const assessmentDefaultRows = courseRows.flatMap((course) =>
    assessmentComponents.map(([componentCode, label, weight]) => ({
      componentCode,
      courseId: course.id,
      createdAt: now,
      id: `${course.id}-assessment-${componentCode.toLowerCase()}`,
      label,
      updatedAt: now,
      weight,
    }))
  );
  for (const rows of chunks(assessmentDefaultRows, 8)) {
    await database
      .insert(courseAssessmentDefaults)
      .values(rows)
      .onConflictDoNothing();
  }

  const overrideRows = curriculumCourseRows
    .filter(
      (row) => row.courseId.endsWith("kwu301") || row.courseId.endsWith("ts301")
    )
    .flatMap((row) =>
      (
        [
          ["QUIZ", "Kuis", 10],
          ["ASSIGNMENT", "Proyek Lapangan", 35],
          ["MIDTERM", "Ujian Tengah Semester", 20],
          ["FINAL", "Ujian Akhir Semester", 35],
        ] as const
      ).map(([componentCode, label, weight]) => ({
        componentCode,
        createdAt: now,
        curriculumCourseId: row.id,
        id: `${row.id}-override-${String(componentCode).toLowerCase()}`,
        label,
        updatedAt: now,
        weight: Number(weight),
      }))
    );
  for (const rows of chunks(overrideRows, 8)) {
    await database
      .insert(curriculumAssessmentOverrides)
      .values(rows)
      .onConflictDoNothing();
  }

  const fileSeeds = [
    ...curriculumRows
      .filter((curriculum) => curriculum.status !== "ARCHIVED")
      .map((curriculum) => ({
        filename: `kurikulum-${curriculum.studyProgramId.endsWith("kewirausahaan") ? "kewirausahaan" : "teknik-sipil"}-${curriculum.id.slice(-4)}.pdf`,
        id: `${curriculum.id}-document`,
        ownerId: curriculum.id,
        ownerType: "CURRICULUM",
        sizeBytes: 1_846_272,
      })),
    {
      filename: "modul-pengantar-kewirausahaan.pdf",
      id: `${SEED_PREFIX}file-modul-kewirausahaan`,
      ownerId: `${SEED_PREFIX}section-kwu-101`,
      ownerType: "LEARNING_MATERIAL",
      sizeBytes: 2_408_576,
    },
    {
      filename: "lembar-kerja-mekanika-bahan.pdf",
      id: `${SEED_PREFIX}file-modul-mekanika-bahan`,
      ownerId: `${SEED_PREFIX}section-ts-301`,
      ownerType: "LEARNING_MATERIAL",
      sizeBytes: 1_259_520,
    },
    {
      filename: "rubrik-proyek-validasi-pasar.pdf",
      id: `${SEED_PREFIX}file-rubrik-validasi-pasar`,
      ownerId: `${SEED_PREFIX}assignment-kwu-101`,
      ownerType: "ASSIGNMENT",
      sizeBytes: 743_424,
    },
    {
      filename: "laporan-pengukuran-balok.pdf",
      id: `${SEED_PREFIX}file-submission-balok`,
      ownerId: `${SEED_PREFIX}submission-ts-301`,
      ownerType: "ASSIGNMENT_SUBMISSION",
      sizeBytes: 3_072_000,
    },
    {
      filename: "presensi-aulia-20260921.jpg",
      id: `${SEED_PREFIX}file-attendance-aulia`,
      ownerId: `${SEED_PREFIX}attendance-aulia`,
      ownerType: "ATTENDANCE_EVIDENCE",
      sizeBytes: 218_112,
    },
  ];
  const fileRows = await Promise.all(
    fileSeeds.map(async (file) => ({
      checksum: await checksumFor(file.id),
      createdAt: now,
      createdBy: superadmin.userId,
      declaredMime: file.filename.endsWith(".jpg")
        ? "image/jpeg"
        : "application/pdf",
      deletedAt: null,
      id: file.id,
      mimeType: file.filename.endsWith(".jpg")
        ? "image/jpeg"
        : "application/pdf",
      objectKey: `private/seed/${file.id}/${file.filename}`,
      originalFilename: file.filename,
      ownerId: file.ownerId,
      ownerType: file.ownerType,
      sizeBytes: file.sizeBytes,
      status: "ACTIVE" as const,
    }))
  );
  for (const rows of chunks(fileRows, 4)) {
    await database.insert(fileObjects).values(rows).onConflictDoNothing();
  }
  await database
    .insert(curriculumDocuments)
    .values(
      curriculumRows
        .filter((curriculum) => curriculum.status !== "ARCHIVED")
        .map((curriculum) => ({
          createdAt: now,
          curriculumId: curriculum.id,
          documentType: "CURRICULUM",
          fileObjectId: `${curriculum.id}-document`,
          id: `${curriculum.id}-document-link`,
          isCurrent: true,
        }))
    )
    .onConflictDoNothing();

  const settingScopeDefinitions = [
    ["online_meeting_max_per_class", 1, programDefinitions[0]?.id],
    ["attendance_radius_meters", 750, programDefinitions[1]?.id],
  ] as const;
  for (const [key, value, scopeId] of settingScopeDefinitions) {
    if (!scopeId) {
      continue;
    }
    const [definition] = await database
      .select({ id: settingDefinitions.id })
      .from(settingDefinitions)
      .where(eq(settingDefinitions.key, key))
      .limit(1);
    if (!definition) {
      continue;
    }
    const settingValueId = `${SEED_PREFIX}setting-value-${key}-${scopeId}`;
    const versionId = `${SEED_PREFIX}setting-version-${key}-${scopeId}-1`;
    await database
      .insert(settingValues)
      .values({
        createdAt: now,
        currentVersionId: versionId,
        definitionId: definition.id,
        id: settingValueId,
        scopeId,
        scopeType: "STUDY_PROGRAM",
        updatedAt: now,
      })
      .onConflictDoNothing();
    await database
      .insert(settingVersions)
      .values({
        createdAt: now,
        createdBy: superadmin.userId,
        effectiveFrom: at("2026-08-01T07:00:00"),
        id: versionId,
        note: "Kebijakan operasional awal tahun akademik 2026/2027.",
        settingValueId,
        valueJson: JSON.stringify(value),
        version: 1,
      })
      .onConflictDoNothing();
    await database
      .insert(policyActivationHistories)
      .values({
        action: "PUBLISHED",
        activatedAt: now,
        activatedBy: superadmin.userId,
        id: `${versionId}-activation`,
        metadata: JSON.stringify({ key, value }),
        policyId: versionId,
        policyType: "SETTING_VERSION",
        previousPolicyId: null,
        scopeId,
        scopeType: "STUDY_PROGRAM",
      })
      .onConflictDoNothing();
  }

  const scaleRows = programDefinitions.map((program) => ({
    effectiveFrom: at("2026-08-01T07:00:00"),
    id: `${SEED_PREFIX}grade-scale-${program.code.toLowerCase()}`,
    name: `Skala nilai ${program.name} 2026/2027`,
    scopeId: program.id,
    scopeType: "STUDY_PROGRAM" as const,
    version: 1,
  }));
  await database
    .insert(gradeScaleSets)
    .values(
      scaleRows.map((scale) => ({
        ...scale,
        createdAt: now,
        createdBy: superadmin.userId,
      }))
    )
    .onConflictDoNothing();
  const scaleEntries = scaleRows.flatMap((scale) =>
    (
      [
        ["A", "Sangat baik", 85, 100, 4],
        ["AB", "Baik sekali", 80, 84.99, 3.5],
        ["B", "Baik", 75, 79.99, 3],
        ["BC", "Cukup baik", 70, 74.99, 2.5],
        ["C", "Cukup", 65, 69.99, 2],
        ["D", "Kurang", 50, 64.99, 1],
        ["E", "Tidak lulus", 0, 49.99, 0],
      ] as const
    ).map(
      ([gradeCode, label, minScore, maxScore, qualityPoints], sortOrder) => ({
        gradeCode,
        id: `${scale.id}-${String(gradeCode).toLowerCase()}`,
        label,
        maxScore: Number(maxScore),
        minScore: Number(minScore),
        qualityPoints: Number(qualityPoints),
        scaleSetId: scale.id,
        sortOrder,
      })
    )
  );
  for (const rows of chunks(scaleEntries, 8)) {
    await database.insert(gradeScaleEntries).values(rows).onConflictDoNothing();
  }

  const planRows = studentDefinitions
    .filter(
      (studentDefinition) => studentDefinition.academicStatus === "ACTIVE"
    )
    .map((studentDefinition) => {
      const program = programDefinitions[studentDefinition.programIndex];
      if (!program) {
        throw new DataSeedError(
          `Program studi untuk ${studentDefinition.name} tidak ditemukan.`
        );
      }
      const curriculumId = `${SEED_PREFIX}curriculum-${program.code.toLowerCase()}-${studentDefinition.cohortYear}`;
      const status = studentDefinition.cohortYear === 2026 ? "DRAFT" : "FINAL";
      return {
        academicPeriodId: CURRENT_PERIOD_ID,
        createdAt: now,
        curriculumId,
        finalizedAt: status === "FINAL" ? at("2026-08-14T07:00:00") : null,
        finalizedBy: status === "FINAL" ? adminAcademicId : null,
        id: `${SEED_PREFIX}plan-${studentDefinition.id}`,
        mode: studentDefinition.cohortYear === 2026 ? "FREE" : "PACKAGE",
        status,
        studentId: studentDefinition.id,
        totalCourses: 2,
        totalCredits: 6,
        updatedAt: now,
        version: status === "FINAL" ? 1 : 0,
      };
    });
  for (const rows of chunks(planRows, 4)) {
    await database.insert(studyPlans).values(rows).onConflictDoNothing();
  }
  const planItems = planRows.flatMap((plan) => {
    const student = studentDefinitions.find(
      (item) => item.id === plan.studentId
    );
    const program = student
      ? programDefinitions[student.programIndex]
      : undefined;
    const targetSemester =
      student?.cohortYear === 2026 ? 1 : student?.cohortYear === 2025 ? 3 : 5;
    const targetCourses = courseRows.filter(
      (course) =>
        course.studyProgramId === program?.id &&
        course.defaultSemester === targetSemester
    );
    return targetCourses.map((course, index) => {
      const curriculumCourseId = curriculumCourseRows.find(
        (row) =>
          row.curriculumId === plan.curriculumId && row.courseId === course.id
      )?.id;
      return {
        courseId: course.id,
        createdAt: now,
        credits: course.credits,
        curriculumCourseId: curriculumCourseId ?? null,
        id: `${plan.id}-item-${course.id}`,
        semester: targetSemester,
        sortOrder: index + 1,
        source: plan.mode,
        studyPlanId: plan.id,
        updatedAt: now,
      };
    });
  });
  for (const rows of chunks(planItems, 8)) {
    await database.insert(studyPlanItems).values(rows).onConflictDoNothing();
  }
  const studyPlanHistoryRows = planRows.flatMap((plan) => [
    {
      action: "GENERATE",
      actorUserId: adminAcademicId,
      createdAt: at("2026-08-10T07:00:00"),
      fromStatus: null,
      id: `${plan.id}-history-generate`,
      metadata: JSON.stringify({ source: plan.mode }),
      reason: "KRS paket awal tahun akademik.",
      studyPlanId: plan.id,
      toStatus: "DRAFT",
    },
    ...(plan.status === "FINAL"
      ? [
          {
            action: "FINALIZE",
            actorUserId: adminAcademicId,
            createdAt: at("2026-08-14T07:00:00"),
            fromStatus: "DRAFT",
            id: `${plan.id}-history-finalize`,
            metadata: null,
            reason: "KRS disahkan oleh administrasi akademik.",
            studyPlanId: plan.id,
            toStatus: "FINAL",
          },
        ]
      : []),
  ]);
  for (const rows of chunks(studyPlanHistoryRows, 6)) {
    await database
      .insert(studyPlanHistories)
      .values(rows)
      .onConflictDoNothing();
  }
  await database
    .insert(studyPlanGenerationJobs)
    .values([
      {
        academicPeriodId: CURRENT_PERIOD_ID,
        checkpointStudentId: null,
        completedCount: planRows.length,
        createdAt: at("2026-08-10T06:30:00"),
        createdBy: adminAcademicId,
        errorCount: 0,
        failureDetails: null,
        id: `${SEED_PREFIX}study-plan-job-completed`,
        idempotencyKey: `${SEED_PREFIX}study-plan-job-completed-key`,
        mode: "PACKAGE",
        processedCount: planRows.length,
        status: "COMPLETED",
        totalCount: planRows.length,
        updatedAt: at("2026-08-10T06:35:00"),
      },
      {
        academicPeriodId: CURRENT_PERIOD_ID,
        checkpointStudentId: studentDefinitions[5]?.id ?? null,
        completedCount: 4,
        createdAt: at("2026-08-11T06:30:00"),
        createdBy: adminAcademicId,
        errorCount: 1,
        failureDetails: JSON.stringify({
          reason: "Kurikulum belum aktif untuk satu mahasiswa.",
        }),
        id: `${SEED_PREFIX}study-plan-job-partial`,
        idempotencyKey: `${SEED_PREFIX}study-plan-job-partial-key`,
        mode: "PACKAGE",
        processedCount: 5,
        status: "PARTIAL_FAILED",
        totalCount: planRows.length,
        updatedAt: at("2026-08-11T06:37:00"),
      },
    ])
    .onConflictDoNothing();

  const classCourseCodes = ["101", "301", "501"] as const;
  const mappingJobs = programDefinitions.map((program) => ({
    academicPeriodId: CURRENT_PERIOD_ID,
    checkpointGroupKey: `${program.code}-mapping-complete`,
    completedCount: 3,
    createdAt: at("2026-08-12T07:00:00"),
    createdBy: adminAcademicId,
    errorCount: 0,
    failureDetails: null,
    id: `${SEED_PREFIX}mapping-job-${program.code.toLowerCase()}`,
    idempotencyKey: `${SEED_PREFIX}mapping-job-${program.code.toLowerCase()}-key`,
    processedCount: 3,
    status: "COMPLETED",
    studyProgramId: program.id,
    totalCount: 3,
    updatedAt: at("2026-08-12T07:05:00"),
  }));
  await database
    .insert(classMappingJobs)
    .values(mappingJobs)
    .onConflictDoNothing();
  const sectionRows = programDefinitions.flatMap((program) =>
    classCourseCodes.map((courseNumber, index) => ({
      academicPeriodId: CURRENT_PERIOD_ID,
      capacity: 40,
      code: `${program.code}-${courseNumber}-A`,
      courseId: `${SEED_PREFIX}course-${program.code.toLowerCase()}${courseNumber}`,
      createdAt: at("2026-08-13T07:00:00"),
      id: `${SEED_PREFIX}section-${program.code.toLowerCase()}-${courseNumber}`,
      index,
      mappingJobId: `${SEED_PREFIX}mapping-job-${program.code.toLowerCase()}`,
      policyLeadDays: 7,
      policyMaxOnlineMeetings: 2,
      status: "PUBLISHED" as const,
      studyProgramId: program.id,
      updatedAt: now,
      version: 1,
    }))
  );
  await database
    .insert(classSections)
    .values(sectionRows)
    .onConflictDoNothing();

  const publishedDraftRows = programDefinitions.map((program) => ({
    academicPeriodId: CURRENT_PERIOD_ID,
    approvedAt: at("2026-08-15T07:00:00"),
    approvedBy:
      authUsers.get(
        lecturerRows[programDefinitions.indexOf(program)]?.id ?? ""
      ) ?? superadmin.userId,
    createdAt: at("2026-08-13T07:00:00"),
    createdBy: adminAcademicId,
    id: `${SEED_PREFIX}schedule-draft-${program.code.toLowerCase()}`,
    publishedAt: at("2026-08-16T07:00:00"),
    publishedBy: adminAcademicId,
    rejectionReason: null,
    status: "PUBLISHED" as const,
    studyProgramId: program.id,
    submittedAt: at("2026-08-14T07:00:00"),
    submittedBy: adminAcademicId,
    updatedAt: now,
    version: 1,
  }));
  await database
    .insert(scheduleDrafts)
    .values([
      ...publishedDraftRows,
      {
        academicPeriodId: CURRENT_PERIOD_ID,
        approvedAt: null,
        approvedBy: null,
        createdAt: at("2026-08-20T07:00:00"),
        createdBy: adminAcademicId,
        id: `${SEED_PREFIX}schedule-draft-rejected`,
        publishedAt: null,
        publishedBy: null,
        rejectionReason: "Bentrok penggunaan ruang pada jadwal ujian akhir.",
        status: "REJECTED" as const,
        studyProgramId: programDefinitions[0]?.id ?? "",
        submittedAt: at("2026-08-21T07:00:00"),
        submittedBy: adminAcademicId,
        updatedAt: now,
        version: 2,
      },
    ])
    .onConflictDoNothing();

  const sectionSchedule = sectionRows.map((section) => {
    const programIndex =
      section.studyProgramId === programDefinitions[0]?.id ? 0 : 1;
    const day = [1, 3, 4][section.index] ?? 1;
    const startHour = 8 + (section.index % 2) * 3;
    const startDate = at(
      `2026-09-${String(7 + programIndex * 2 + section.index * 2).padStart(2, "0")}T${String(startHour).padStart(2, "0")}:00:00`
    );
    const endDate = new Date(startDate.getTime() + 150 * 60 * 1000);
    const online = section.index === 1;
    return {
      day,
      endDate,
      online,
      roomId: online
        ? null
        : (roomDefinitions[
            (programIndex * 3 + section.index) % roomDefinitions.length
          ]?.id ?? null),
      section,
      startDate,
    };
  });
  await database
    .insert(scheduleSlots)
    .values(
      sectionSchedule.map((schedule) => ({
        classSectionId: schedule.section.id,
        createdAt: now,
        endAt: schedule.endDate,
        id: `${schedule.section.id}-slot`,
        instructions: schedule.online
          ? "Pertemuan menggunakan ruang virtual resmi program studi."
          : "Hadir 10 menit sebelum kelas dimulai.",
        modality: schedule.online ? ("ONLINE" as const) : ("OFFLINE" as const),
        onlineUrl: schedule.online
          ? `https://meet.akademika.ac.id/kelas/${schedule.section.code.toLowerCase()}`
          : null,
        roomId: schedule.roomId,
        scheduleDraftId: `${SEED_PREFIX}schedule-draft-${schedule.section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}`,
        startAt: schedule.startDate,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing();
  const examScheduleRows = sectionRows.flatMap((section, index) => [
    {
      classSectionId: section.id,
      createdAt: now,
      endAt: at(`2026-12-${String(7 + (index % 3)).padStart(2, "0")}T10:00:00`),
      examType: "UTS",
      id: `${section.id}-exam-uts`,
      roomId: roomDefinitions[index % roomDefinitions.length]?.id ?? null,
      scheduleDraftId: `${SEED_PREFIX}schedule-draft-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}`,
      startAt: at(
        `2026-12-${String(7 + (index % 3)).padStart(2, "0")}T08:00:00`
      ),
      updatedAt: now,
    },
    {
      classSectionId: section.id,
      createdAt: now,
      endAt: at(`2027-01-${String(4 + (index % 3)).padStart(2, "0")}T10:00:00`),
      examType: "UAS",
      id: `${section.id}-exam-uas`,
      roomId: roomDefinitions[(index + 2) % roomDefinitions.length]?.id ?? null,
      scheduleDraftId: `${SEED_PREFIX}schedule-draft-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}`,
      startAt: at(
        `2027-01-${String(4 + (index % 3)).padStart(2, "0")}T08:00:00`
      ),
      updatedAt: now,
    },
  ]);
  for (const rows of chunks(examScheduleRows, 6)) {
    await database.insert(examSchedules).values(rows).onConflictDoNothing();
  }
  await database
    .insert(scheduleApprovals)
    .values([
      ...publishedDraftRows.map((draft) => ({
        actorUserId: draft.approvedBy,
        createdAt: draft.approvedAt ?? now,
        decision: "APPROVED",
        draftVersion: 1,
        id: `${draft.id}-approval`,
        reason: "Jadwal memenuhi ketersediaan dosen dan ruang.",
        scheduleDraftId: draft.id,
      })),
      {
        actorUserId: adminAcademicId,
        createdAt: at("2026-08-22T07:00:00"),
        decision: "REJECTED",
        draftVersion: 2,
        id: `${SEED_PREFIX}schedule-draft-rejected-approval`,
        reason: "Bentrok ruang ujian perlu diperbaiki.",
        scheduleDraftId: `${SEED_PREFIX}schedule-draft-rejected`,
      },
    ])
    .onConflictDoNothing();

  await database
    .insert(lecturerAvailabilities)
    .values(
      lecturerRows.flatMap((lecturer, index) => [
        {
          academicPeriodId: CURRENT_PERIOD_ID,
          createdAt: now,
          dayOfWeek: 1 + (index % 5),
          endMinute: 720,
          id: `${lecturer.id}-availability-1`,
          lecturerId: lecturer.id,
          startMinute: 480,
          updatedAt: now,
        },
        {
          academicPeriodId: CURRENT_PERIOD_ID,
          createdAt: now,
          dayOfWeek: 3 + (index % 3),
          endMinute: 960,
          id: `${lecturer.id}-availability-2`,
          lecturerId: lecturer.id,
          startMinute: 780,
          updatedAt: now,
        },
      ])
    )
    .onConflictDoNothing();

  const meetingRows = sectionSchedule.flatMap((schedule) =>
    [0, 1, 2].map((meetingIndex) => {
      const startAt = new Date(
        schedule.startDate.getTime() + meetingIndex * 7 * 24 * 60 * 60 * 1000
      );
      const endAt = new Date(
        schedule.endDate.getTime() + meetingIndex * 7 * 24 * 60 * 60 * 1000
      );
      return {
        classSectionId: schedule.section.id,
        createdAt: now,
        endAt,
        id: `${schedule.section.id}-meeting-${meetingIndex + 1}`,
        instructions:
          meetingIndex === 0
            ? "Baca kontrak perkuliahan sebelum pertemuan pertama."
            : null,
        modality: schedule.online ? ("ONLINE" as const) : ("OFFLINE" as const),
        onlineUrl: schedule.online
          ? `https://meet.akademika.ac.id/kelas/${schedule.section.code.toLowerCase()}`
          : null,
        roomId: schedule.roomId,
        sequence: meetingIndex + 1,
        startAt,
        updatedAt: now,
        version: 1,
      };
    })
  );
  for (const rows of chunks(meetingRows, 8)) {
    await database.insert(classMeetings).values(rows).onConflictDoNothing();
  }
  const baseRevisions = meetingRows.map((meeting) => ({
    changeRequestId: null,
    changedBy: adminAcademicId,
    createdAt: now,
    effectiveFrom: meeting.startAt,
    effectiveUntil: null,
    endAt: meeting.endAt,
    id: `${meeting.id}-revision-1`,
    instructions: meeting.instructions,
    meetingId: meeting.id,
    modality: meeting.modality,
    onlineUrl: meeting.onlineUrl,
    reason: "Publikasi jadwal awal semester.",
    roomId: meeting.roomId,
    startAt: meeting.startAt,
    version: 1,
  }));
  for (const rows of chunks(baseRevisions, 5)) {
    await database.insert(scheduleRevisions).values(rows).onConflictDoNothing();
  }

  const changeRequestRows = [
    {
      createdAt: at("2026-09-01T07:00:00"),
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
      id: `${SEED_PREFIX}change-request-pending`,
      meetingId: `${SEED_PREFIX}section-kwu-301-meeting-2`,
      proposedEndAt: at("2026-09-16T13:00:00"),
      proposedRoomId: roomDefinitions[1]?.id ?? "",
      proposedStartAt: at("2026-09-16T10:30:00"),
      reason: "Dosen menghadiri rapat akreditasi pada jadwal semula.",
      requestedBy: authUsers.get(lecturerRows[1]?.id ?? "") ?? adminAcademicId,
      status: "PENDING",
      updatedAt: now,
    },
    {
      createdAt: at("2026-08-25T07:00:00"),
      decidedAt: at("2026-08-27T07:00:00"),
      decidedBy: authUsers.get(lecturerRows[0]?.id ?? "") ?? superadmin.userId,
      decisionReason: "Disetujui, ruang pengganti tersedia.",
      id: `${SEED_PREFIX}change-request-approved`,
      meetingId: `${SEED_PREFIX}section-kwu-101-meeting-2`,
      proposedEndAt: at("2026-09-15T10:30:00"),
      proposedRoomId: roomDefinitions[1]?.id ?? "",
      proposedStartAt: at("2026-09-15T08:00:00"),
      reason: "Penyesuaian jadwal praktikum mahasiswa.",
      requestedBy: authUsers.get(lecturerRows[0]?.id ?? "") ?? adminAcademicId,
      status: "APPROVED",
      updatedAt: at("2026-08-27T07:00:00"),
    },
    {
      createdAt: at("2026-08-26T07:00:00"),
      decidedAt: at("2026-08-28T07:00:00"),
      decidedBy: authUsers.get(lecturerRows[3]?.id ?? "") ?? superadmin.userId,
      decisionReason: "Ditolak karena berbenturan dengan ujian terjadwal.",
      id: `${SEED_PREFIX}change-request-rejected`,
      meetingId: `${SEED_PREFIX}section-ts-501-meeting-1`,
      proposedEndAt: at("2026-09-10T16:30:00"),
      proposedRoomId: roomDefinitions[4]?.id ?? "",
      proposedStartAt: at("2026-09-10T14:00:00"),
      reason: "Permintaan pertukaran jadwal kelas.",
      requestedBy: authUsers.get(lecturerRows[3]?.id ?? "") ?? adminAcademicId,
      status: "REJECTED",
      updatedAt: at("2026-08-28T07:00:00"),
    },
  ];
  await database
    .insert(scheduleChangeRequests)
    .values(changeRequestRows)
    .onConflictDoNothing();
  await database
    .insert(scheduleRevisions)
    .values({
      changeRequestId: `${SEED_PREFIX}change-request-approved`,
      changedBy: authUsers.get(lecturerRows[0]?.id ?? "") ?? superadmin.userId,
      createdAt: at("2026-08-27T07:00:00"),
      effectiveFrom: at("2026-09-15T08:00:00"),
      effectiveUntil: null,
      endAt: at("2026-09-15T10:30:00"),
      id: `${SEED_PREFIX}section-kwu-101-meeting-2-revision-2`,
      instructions: "Jadwal pengganti berdasarkan persetujuan Kaprodi.",
      meetingId: `${SEED_PREFIX}section-kwu-101-meeting-2`,
      modality: "OFFLINE",
      onlineUrl: null,
      reason: "Perubahan jadwal disetujui.",
      roomId: roomDefinitions[1]?.id ?? null,
      startAt: at("2026-09-15T08:00:00"),
      version: 2,
    })
    .onConflictDoNothing();

  await database
    .insert(scheduleConflicts)
    .values([
      {
        classSectionId: `${SEED_PREFIX}section-kwu-101`,
        conflictType: "ROOM_OVERLAP",
        createdAt: at("2026-08-20T07:00:00"),
        endAt: at("2026-12-12T10:00:00"),
        entityIds: JSON.stringify([
          `${SEED_PREFIX}section-kwu-101`,
          `${SEED_PREFIX}section-ts-101`,
        ]),
        id: `${SEED_PREFIX}conflict-warning-resolved`,
        message: "Ruang GKB A201 pernah dipakai pada rentang waktu yang sama.",
        resolution: "Jadwal Teknik Sipil dipindahkan ke GKB C101.",
        resolvedAt: at("2026-08-21T07:00:00"),
        resolvedBy: adminAcademicId,
        scheduleDraftId: `${SEED_PREFIX}schedule-draft-kwu`,
        severity: "WARNING",
        startAt: at("2026-12-12T07:30:00"),
      },
      {
        classSectionId: null,
        conflictType: "EXAM_ROOM_OVERLAP",
        createdAt: at("2026-08-21T07:00:00"),
        endAt: at("2027-01-04T10:00:00"),
        entityIds: JSON.stringify([
          `${SEED_PREFIX}section-kwu-501`,
          `${SEED_PREFIX}section-ts-501`,
        ]),
        id: `${SEED_PREFIX}conflict-blocking-unresolved`,
        message:
          "Ruang ujian D102 digunakan oleh dua kelas pada waktu yang sama.",
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
        scheduleDraftId: `${SEED_PREFIX}schedule-draft-rejected`,
        severity: "BLOCKING",
        startAt: at("2027-01-04T07:30:00"),
      },
    ])
    .onConflictDoNothing();

  const enrollmentRows = sectionRows.flatMap((section) => {
    const course = courseRows.find((course) => course.id === section.courseId);
    const studentsForSection = studentDefinitions.filter(
      (student) =>
        student.academicStatus === "ACTIVE" &&
        student.programIndex ===
          (section.studyProgramId === programDefinitions[0]?.id ? 0 : 1) &&
        student.cohortYear ===
          (course?.defaultSemester === 1
            ? 2026
            : course?.defaultSemester === 3
              ? 2025
              : 2024)
    );
    return studentsForSection.map((student) => {
      const plan = planRows.find((plan) => plan.studentId === student.id);
      const item = planItems.find(
        (item) =>
          item.studyPlanId === plan?.id && item.courseId === section.courseId
      );
      return {
        classSectionId: section.id,
        createdAt: now,
        id: `${section.id}-enrollment-${student.id}`,
        studentId: student.id,
        studyPlanId: plan?.id ?? `${SEED_PREFIX}plan-${student.id}`,
        studyPlanItemId:
          item?.id ??
          `${SEED_PREFIX}plan-${student.id}-item-${section.courseId}`,
      };
    });
  });
  for (const rows of chunks(enrollmentRows, 8)) {
    await database.insert(classEnrollments).values(rows).onConflictDoNothing();
  }
  const teachingAssignmentRows = sectionRows.flatMap((section, index) => {
    const programIndex =
      section.studyProgramId === programDefinitions[0]?.id ? 0 : 1;
    const lead = lecturerRows[programIndex * 3];
    const support = lecturerRows[programIndex * 3 + 1 + (index % 2)];
    return [
      {
        classSectionId: section.id,
        createdAt: now,
        id: `${section.id}-assignment-primary`,
        isPrimary: true,
        lecturerId: lead?.id ?? "",
      },
      {
        classSectionId: section.id,
        createdAt: now,
        id: `${section.id}-assignment-support`,
        isPrimary: false,
        lecturerId: support?.id ?? lead?.id ?? "",
      },
    ];
  });
  for (const rows of chunks(teachingAssignmentRows, 8)) {
    await database
      .insert(teachingAssignments)
      .values(rows)
      .onConflictDoNothing();
  }
  for (const enrollment of enrollmentRows) {
    const studentUserId = authUsers.get(enrollment.studentId);
    if (studentUserId) {
      await database
        .insert(userScopes)
        .values({
          createdAt: now,
          endsAt: null,
          id: `${SEED_PREFIX}scope-student-${enrollment.studentId}`,
          scopeId: enrollment.studentId,
          scopeType: "OWNERSHIP",
          startsAt: at("2026-08-01T07:00:00"),
          userId: studentUserId,
        })
        .onConflictDoNothing();
    }
  }

  const gradeComponentRows = sectionRows.flatMap((section) =>
    assessmentComponents.map(([componentCode, label, weight], sortOrder) => ({
      classSectionId: section.id,
      componentCode,
      createdAt: now,
      id: `${section.id}-grade-component-${componentCode.toLowerCase()}`,
      label,
      sortOrder,
      weight,
    }))
  );
  for (const rows of chunks(gradeComponentRows, 8)) {
    await database
      .insert(classGradeComponents)
      .values(rows)
      .onConflictDoNothing();
  }
  const componentScores = enrollmentRows.flatMap(
    (enrollment, enrollmentIndex) =>
      gradeComponentRows
        .filter(
          (component) => component.classSectionId === enrollment.classSectionId
        )
        .map((component, componentIndex) => ({
          classGradeComponentId: component.id,
          createdAt: now,
          id: `${enrollment.id}-score-${component.componentCode.toLowerCase()}`,
          scoreHundredths:
            [8800, 8200, 7900, 9100][(enrollmentIndex + componentIndex) % 4] ??
            8000,
          studentId: enrollment.studentId,
          updatedAt: now,
          version: 1,
        }))
  );
  for (const rows of chunks(componentScores, 8)) {
    await database
      .insert(studentComponentScores)
      .values(rows)
      .onConflictDoNothing();
  }
  await database
    .insert(gradeSubmissionBatches)
    .values(
      sectionRows.map((section, index) => ({
        actorUserId:
          authUsers.get(
            lecturerRows[
              (section.studyProgramId === programDefinitions[0]?.id ? 0 : 1) * 3
            ]?.id ?? ""
          ) ?? superadmin.userId,
        classSectionId: section.id,
        createdAt: at("2026-12-22T07:00:00"),
        id: `${section.id}-grade-batch`,
        status: index === 0 ? "SUBMITTED" : "PUBLISHED",
        submittedAt: at("2026-12-23T07:00:00"),
        version: 1,
      }))
    )
    .onConflictDoNothing();

  const finalGradeRows = enrollmentRows.map((enrollment, index) => {
    const rawScoreHundredths = [8750, 8150, 7850, 9250][index % 4] ?? 8000;
    const grade = gradeForScore(rawScoreHundredths);
    return {
      attempt: 1,
      classSectionId: enrollment.classSectionId,
      createdAt: at("2026-12-24T07:00:00"),
      gradeCode: grade.code,
      gradePoint: grade.point,
      id: `${enrollment.id}-final-grade`,
      policyVersion: "grading-2026-v1",
      rawScoreHundredths,
      roundedScoreHundredths: rawScoreHundredths,
      scaleVersionId: `${SEED_PREFIX}grade-scale-${enrollment.classSectionId.startsWith(`${SEED_PREFIX}section-kwu`) ? "kwu" : "ts"}`,
      studentId: enrollment.studentId,
      takenAt: at("2026-12-24T07:00:00"),
    };
  });
  for (const rows of chunks(finalGradeRows, 8)) {
    await database
      .insert(finalGradeSnapshots)
      .values(rows)
      .onConflictDoNothing();
  }
  await database
    .insert(gradePublications)
    .values(
      sectionRows.map((section, index) => ({
        academicPeriodId: CURRENT_PERIOD_ID,
        classSectionId: section.id,
        createdAt: at("2026-12-24T08:00:00"),
        id: `${section.id}-publication`,
        publishedAt: index === 0 ? at("2026-12-24T09:00:00") : null,
        publishedBy: index === 0 ? adminAcademicId : null,
        status: index === 0 ? "PUBLISHED" : "PENDING",
        version: 1,
      }))
    )
    .onConflictDoNothing();

  const resultByStudent = new Map<string, string>();
  for (const student of studentDefinitions.filter(
    (item) => item.academicStatus === "ACTIVE"
  )) {
    const id = `${SEED_PREFIX}result-${student.id}`;
    resultByStudent.set(student.id, id);
    await database
      .insert(studyResultSnapshots)
      .values({
        academicPeriodId: CURRENT_PERIOD_ID,
        builtAt: at("2026-12-26T07:00:00"),
        countedCredits: 6,
        countedQualityPointsHundredths: 1950,
        id,
        ipkHundredths: 325,
        ipsHundredths: 325,
        policyVersion: "grading-2026-v1",
        retakePolicy: "HIGHEST",
        studentId: student.id,
      })
      .onConflictDoNothing();
  }
  const transcriptRows = finalGradeRows.map((grade) => {
    const courseId = sectionRows.find(
      (section) => section.id === grade.classSectionId
    )?.courseId;
    return {
      academicPeriodId: CURRENT_PERIOD_ID,
      attempt: 1,
      courseId: courseId ?? "",
      credits:
        courseRows.find((course) => course.id === courseId)?.credits ?? 3,
      finalGradeSnapshotId: grade.id,
      gradeCode: grade.gradeCode,
      gradePointHundredths: grade.gradePoint,
      id: `${grade.id}-transcript`,
      studentId: grade.studentId,
      studyResultSnapshotId: resultByStudent.get(grade.studentId) ?? "",
    };
  });
  for (const rows of chunks(transcriptRows, 6)) {
    await database.insert(transcriptEntries).values(rows).onConflictDoNothing();
  }
  const adjustmentTarget = finalGradeRows[0];
  if (adjustmentTarget) {
    await database
      .insert(gradeAdjustments)
      .values({
        actorUserId: adminAcademicId,
        createdAt: at("2026-12-27T07:00:00"),
        finalGradeSnapshotId: adjustmentTarget.id,
        id: `${adjustmentTarget.id}-adjustment-1`,
        newValue: JSON.stringify({ gradeCode: "A", scoreHundredths: 8750 }),
        oldValue: JSON.stringify({
          gradeCode: adjustmentTarget.gradeCode,
          scoreHundredths: adjustmentTarget.rawScoreHundredths,
        }),
        reason: "Koreksi nilai komponen tugas setelah verifikasi berita acara.",
      })
      .onConflictDoNothing();
  }

  const attendanceSessionRows = meetingRows.map((meeting) => ({
    classSectionId: meeting.classSectionId,
    closeAt: new Date(meeting.endAt.getTime() + 60 * 60 * 1000),
    createdAt: now,
    endAt: meeting.endAt,
    id: `${meeting.id}-attendance`,
    meetingId: meeting.id,
    modality: meeting.modality,
    openAt: new Date(meeting.startAt.getTime() + 30 * 60 * 1000),
    policyRadiusMeters: meeting.modality === "OFFLINE" ? 1000 : 0,
    policyVersion: "attendance-2026-v1",
    scheduleRevisionId: `${meeting.id}-revision-1`,
    startAt: meeting.startAt,
    updatedAt: now,
  }));
  for (const rows of chunks(attendanceSessionRows, 7)) {
    await database
      .insert(attendanceSessions)
      .values(rows)
      .onConflictDoNothing();
  }
  const attendanceEnrollmentRows = enrollmentRows.flatMap((enrollment) =>
    attendanceSessionRows
      .filter((session) => session.classSectionId === enrollment.classSectionId)
      .map((session, sessionIndex) => ({ enrollment, session, sessionIndex }))
  );
  const attendanceRecordRows = attendanceEnrollmentRows.map(
    ({ enrollment, session, sessionIndex }, index) => ({
      createdAt: session.startAt,
      id: `${session.id}-record-${enrollment.studentId}`,
      note: index % 9 === 0 ? "Menyerahkan bukti kepada dosen pengampu." : null,
      participantId: enrollment.studentId,
      participantType: "STUDENT",
      sessionId: session.id,
      status:
        index % 11 === 0
          ? "ALPA"
          : index % 7 === 0
            ? "IZIN"
            : index % 5 === 0
              ? "SAKIT"
              : "HADIR",
      submittedAt: new Date(session.startAt.getTime() + 45 * 60 * 1000),
      updatedAt: now,
      version: sessionIndex === 0 ? 2 : 1,
    })
  );
  for (const rows of chunks(attendanceRecordRows, 8)) {
    await database.insert(attendanceRecords).values(rows).onConflictDoNothing();
  }
  const evidenceCandidates = attendanceRecordRows
    .filter((_, index) => index % 17 === 0)
    .slice(0, 2);
  const captureRows = evidenceCandidates.map((record, index) => ({
    createdAt: record.createdAt,
    expiresAt: plusDays(record.submittedAt, 1),
    id: `${record.id}-capture`,
    modality: "OFFLINE",
    nonceHash: `${SEED_PREFIX}nonce-${index + 1}-${record.id}`,
    participantId: record.participantId,
    participantType: "STUDENT",
    sessionId: record.sessionId,
    usedAt: record.submittedAt,
  }));
  await database
    .insert(attendanceCaptureAttempts)
    .values(captureRows)
    .onConflictDoNothing();
  await database
    .insert(attendanceEvidences)
    .values(
      evidenceCandidates.map((record, index) => ({
        accuracyMeters: 4.2 + index,
        attendanceRecordId: record.id,
        captureAttemptId: captureRows[index]?.id ?? "",
        capturedAt: record.submittedAt,
        checksum:
          fileRows.find(
            (file) => file.id === `${SEED_PREFIX}file-attendance-aulia`
          )?.checksum ?? "",
        createdAt: now,
        dimensionHeight: 1920,
        dimensionWidth: 1080,
        distanceMeters: 38 + index * 11,
        evidenceType: "PHOTO",
        fileObjectId: `${SEED_PREFIX}file-attendance-aulia`,
        id: `${record.id}-evidence`,
        latitude: -6.914744 + index * 0.00003,
        longitude: 107.60981 + index * 0.00003,
        mimeType: "image/jpeg",
        policyRadiusMeters: 1000,
        referenceLatitude: -6.914744,
        referenceLongitude: 107.60981,
        sizeBytes: 218_112,
      }))
    )
    .onConflictDoNothing();

  const requestRecord = attendanceRecordRows.find(
    (record) => record.status === "ALPA"
  );
  const approvedRecord = attendanceRecordRows.find(
    (record) => record.status === "IZIN"
  );
  const rejectedRecord = attendanceRecordRows.find(
    (record) => record.status === "SAKIT"
  );
  const attendanceRequestRows = [
    requestRecord
      ? {
          attendanceRecordId: requestRecord.id,
          createdAt: now,
          decidedAt: null,
          decidedBy: null,
          decisionReason: null,
          id: `${requestRecord.id}-request`,
          requestedStatus: "IZIN",
          status: "PENDING",
        }
      : null,
    approvedRecord
      ? {
          attendanceRecordId: approvedRecord.id,
          createdAt: at("2026-09-18T07:00:00"),
          decidedAt: at("2026-09-19T07:00:00"),
          decidedBy: superadmin.userId,
          decisionReason: "Surat izin kegiatan institusi telah diverifikasi.",
          id: `${approvedRecord.id}-request`,
          requestedStatus: "IZIN",
          status: "APPROVED",
        }
      : null,
    rejectedRecord
      ? {
          attendanceRecordId: rejectedRecord.id,
          createdAt: at("2026-09-18T07:00:00"),
          decidedAt: at("2026-09-19T07:00:00"),
          decidedBy: superadmin.userId,
          decisionReason: "Bukti sakit belum memenuhi ketentuan.",
          id: `${rejectedRecord.id}-request`,
          requestedStatus: "SAKIT",
          status: "REJECTED",
        }
      : null,
  ].filter((request): request is NonNullable<typeof request> =>
    Boolean(request)
  );
  await database
    .insert(attendanceRequests)
    .values(attendanceRequestRows)
    .onConflictDoNothing();
  await database
    .insert(attendanceReviewLogs)
    .values(
      attendanceRequestRows
        .filter((request) => request.status !== "PENDING")
        .map((request) => ({
          actorUserId: request.decidedBy,
          attendanceRequestId: request.id,
          createdAt: request.decidedAt ?? now,
          decision: request.status === "APPROVED" ? "APPROVED" : "REJECTED",
          id: `${request.id}-review`,
          reason: request.decisionReason,
        }))
    )
    .onConflictDoNothing();
  if (approvedRecord) {
    await database
      .insert(attendanceAdjustments)
      .values({
        actorUserId: superadmin.userId,
        attendanceRecordId: approvedRecord.id,
        createdAt: at("2026-09-19T07:05:00"),
        fromStatus: "IZIN",
        id: `${approvedRecord.id}-adjustment`,
        reason: "Status diselaraskan dengan keputusan permohonan presensi.",
        toStatus: "IZIN",
        version: 2,
      })
      .onConflictDoNothing();
  }
  const firstSession = attendanceSessionRows[0];
  const secondSession = attendanceSessionRows[1];
  if (firstSession && secondSession) {
    await database
      .insert(attendanceGenerationJobs)
      .values([
        {
          completedCount: enrollmentRows.filter(
            (row) => row.classSectionId === firstSession.classSectionId
          ).length,
          createdAt: at("2026-09-07T07:00:00"),
          cursor: null,
          errorCount: 0,
          errorDetails: null,
          id: `${firstSession.id}-generation-completed`,
          idempotencyKey: `${SEED_PREFIX}attendance-job-${firstSession.id}`,
          processedCount: enrollmentRows.filter(
            (row) => row.classSectionId === firstSession.classSectionId
          ).length,
          sessionId: firstSession.id,
          status: "COMPLETED",
          totalCount: enrollmentRows.filter(
            (row) => row.classSectionId === firstSession.classSectionId
          ).length,
          updatedAt: at("2026-09-07T07:10:00"),
        },
        {
          completedCount: 1,
          createdAt: at("2026-09-14T07:00:00"),
          cursor: "student-2",
          errorCount: 1,
          errorDetails: JSON.stringify({
            reason: "Identitas tidak ditemukan.",
            studentId: "invalid-student",
          }),
          id: `${secondSession.id}-generation-partial`,
          idempotencyKey: `${SEED_PREFIX}attendance-job-${secondSession.id}`,
          processedCount: 2,
          sessionId: secondSession.id,
          status: "PARTIAL_FAILED",
          totalCount: 3,
          updatedAt: at("2026-09-14T07:10:00"),
        },
      ])
      .onConflictDoNothing();
  }

  const lmsSections = sectionRows.filter((section) =>
    section.code.endsWith("101-A")
  );
  const materialRows = lmsSections.flatMap((section) => [
    {
      body:
        section.studyProgramId === programDefinitions[0]?.id
          ? "Materi membahas identifikasi masalah pelanggan, proposisi nilai, dan validasi awal model bisnis."
          : "Materi membahas konsep dasar tegangan, regangan, dan interpretasi hasil uji tarik bahan.",
      classMeetingId: `${section.id}-meeting-1`,
      classSectionId: section.id,
      createdAt: at("2026-09-01T07:00:00"),
      createdBy:
        authUsers.get(
          lecturerRows[
            section.studyProgramId === programDefinitions[0]?.id ? 0 : 3
          ]?.id ?? ""
        ) ?? superadmin.userId,
      id: `${SEED_PREFIX}material-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}-published`,
      publishedAt: at("2026-09-02T07:00:00"),
      publishedBy: adminAcademicId,
      status: "PUBLISHED" as const,
      title:
        section.studyProgramId === programDefinitions[0]?.id
          ? "Validasi masalah dan peluang pasar"
          : "Dasar mekanika bahan",
      updatedAt: now,
      version: 1,
    },
    {
      body: "Bahan bacaan tambahan untuk diskusi pertemuan berikutnya.",
      classMeetingId: `${section.id}-meeting-2`,
      classSectionId: section.id,
      createdAt: now,
      createdBy:
        authUsers.get(
          lecturerRows[
            section.studyProgramId === programDefinitions[0]?.id ? 0 : 3
          ]?.id ?? ""
        ) ?? superadmin.userId,
      id: `${SEED_PREFIX}material-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}-draft`,
      publishedAt: null,
      publishedBy: null,
      status: "DRAFT" as const,
      title: "Bahan diskusi lanjutan",
      updatedAt: now,
      version: 0,
    },
  ]);
  await database
    .insert(learningMaterials)
    .values(materialRows)
    .onConflictDoNothing();
  await database
    .insert(materialFiles)
    .values([
      {
        createdAt: now,
        fileObjectId: `${SEED_PREFIX}file-modul-kewirausahaan`,
        id: `${SEED_PREFIX}material-kwu-file`,
        materialId: `${SEED_PREFIX}material-kwu-published`,
      },
      {
        createdAt: now,
        fileObjectId: `${SEED_PREFIX}file-modul-mekanika-bahan`,
        id: `${SEED_PREFIX}material-ts-file`,
        materialId: `${SEED_PREFIX}material-ts-published`,
      },
    ])
    .onConflictDoNothing();
  const assignmentRows = lmsSections.map((section) => ({
    allowResubmit: true,
    body:
      section.studyProgramId === programDefinitions[0]?.id
        ? "Susun ringkasan wawancara calon pelanggan dan rumuskan tiga hipotesis nilai."
        : "Hitung tegangan dan regangan dari data uji tarik yang tersedia pada lampiran.",
    classMeetingId: `${section.id}-meeting-2`,
    classSectionId: section.id,
    createdAt: at("2026-09-08T07:00:00"),
    createdBy:
      authUsers.get(
        lecturerRows[
          section.studyProgramId === programDefinitions[0]?.id ? 0 : 3
        ]?.id ?? ""
      ) ?? superadmin.userId,
    dueAt: at("2026-09-22T16:00:00"),
    id: `${SEED_PREFIX}assignment-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}`,
    publishedAt: at("2026-09-09T07:00:00"),
    publishedBy: adminAcademicId,
    status: "PUBLISHED" as const,
    title:
      section.studyProgramId === programDefinitions[0]?.id
        ? "Validasi masalah pelanggan"
        : "Laporan uji tarik bahan",
    updatedAt: now,
    version: 1,
  }));
  await database
    .insert(assignments)
    .values(assignmentRows)
    .onConflictDoNothing();
  await database
    .insert(assignmentFiles)
    .values({
      assignmentId: `${SEED_PREFIX}assignment-kwu`,
      createdAt: now,
      fileObjectId: `${SEED_PREFIX}file-rubrik-validasi-pasar`,
      id: `${SEED_PREFIX}assignment-kwu-file`,
    })
    .onConflictDoNothing();
  const firstKwuEnrollment = enrollmentRows.find(
    (enrollment) =>
      enrollment.classSectionId === `${SEED_PREFIX}section-kwu-101`
  );
  const firstTsEnrollment = enrollmentRows.find(
    (enrollment) => enrollment.classSectionId === `${SEED_PREFIX}section-ts-101`
  );
  const submissionRows = [
    firstKwuEnrollment
      ? {
          assignmentId: `${SEED_PREFIX}assignment-kwu`,
          body: "Hasil wawancara menunjukkan pelaku UMKM membutuhkan pencatatan arus kas yang sederhana.",
          createdAt: at("2026-09-19T08:00:00"),
          id: `${SEED_PREFIX}submission-kwu`,
          isLate: false,
          status: "SUBMITTED" as const,
          studentId: firstKwuEnrollment.studentId,
          submittedAt: at("2026-09-19T08:00:00"),
          version: 1,
        }
      : null,
    firstTsEnrollment
      ? {
          assignmentId: `${SEED_PREFIX}assignment-ts`,
          body: "Perhitungan tegangan maksimum dan grafik hasil pengujian terlampir.",
          createdAt: at("2026-09-23T08:00:00"),
          id: `${SEED_PREFIX}submission-ts-301`,
          isLate: true,
          status: "LATE" as const,
          studentId: firstTsEnrollment.studentId,
          submittedAt: at("2026-09-23T08:00:00"),
          version: 1,
        }
      : null,
  ].filter((submission): submission is NonNullable<typeof submission> =>
    Boolean(submission)
  );
  await database
    .insert(assignmentSubmissions)
    .values(submissionRows)
    .onConflictDoNothing();
  await database
    .insert(submissionFiles)
    .values({
      createdAt: now,
      fileObjectId: `${SEED_PREFIX}file-submission-balok`,
      id: `${SEED_PREFIX}submission-ts-file`,
      submissionId: `${SEED_PREFIX}submission-ts-301`,
    })
    .onConflictDoNothing();

  const forumRows = lmsSections.map((section) => ({
    classMeetingId: `${section.id}-meeting-1`,
    classSectionId: section.id,
    createdAt: at("2026-09-10T07:00:00"),
    createdBy:
      authUsers.get(
        lecturerRows[
          section.studyProgramId === programDefinitions[0]?.id ? 0 : 3
        ]?.id ?? ""
      ) ?? superadmin.userId,
    id: `${SEED_PREFIX}forum-${section.studyProgramId === programDefinitions[0]?.id ? "kwu" : "ts"}`,
    status: "OPEN" as const,
    title:
      section.studyProgramId === programDefinitions[0]?.id
        ? "Diskusi hasil validasi pelanggan"
        : "Interpretasi hasil uji bahan",
    updatedAt: now,
  }));
  await database.insert(forumThreads).values(forumRows).onConflictDoNothing();
  const forumPostsRows = forumRows.flatMap((thread, index) => {
    const section = lmsSections[index];
    const student = enrollmentRows.find(
      (enrollment) => enrollment.classSectionId === section?.id
    );
    return [
      {
        authorId: thread.createdBy,
        body: "Silakan gunakan forum ini untuk membandingkan temuan dan menyertakan sumber data.",
        createdAt: thread.createdAt,
        deletedAt: null,
        editedAt: null,
        id: `${thread.id}-post-lecturer`,
        threadId: thread.id,
      },
      {
        authorId: student
          ? (authUsers.get(student.studentId) ?? thread.createdBy)
          : thread.createdBy,
        body: "Saya menemukan pola yang konsisten setelah mengelompokkan jawaban responden.",
        createdAt: at("2026-09-11T08:00:00"),
        deletedAt: null,
        editedAt: at("2026-09-11T08:15:00"),
        id: `${thread.id}-post-student`,
        threadId: thread.id,
      },
    ];
  });
  await database
    .insert(forumPosts)
    .values(forumPostsRows)
    .onConflictDoNothing();
  await database
    .insert(forumAttachments)
    .values({
      createdAt: now,
      fileObjectId: `${SEED_PREFIX}file-modul-kewirausahaan`,
      id: `${SEED_PREFIX}forum-kwu-attachment`,
      postId: `${SEED_PREFIX}forum-kwu-post-lecturer`,
    })
    .onConflictDoNothing();

  const importFileId = `${SEED_PREFIX}file-import-students`;
  if (!fileRows.some((file) => file.id === importFileId)) {
    await database
      .insert(fileObjects)
      .values({
        checksum: await checksumFor(importFileId),
        createdAt: now,
        createdBy: adminAcademicId,
        declaredMime: "text/csv",
        deletedAt: null,
        id: importFileId,
        mimeType: "text/csv",
        objectKey: `private/seed/${importFileId}/mahasiswa-2026-09-28.csv`,
        originalFilename: "mahasiswa-2026-09-28.csv",
        ownerId: adminAcademicId,
        ownerType: "IMPORT_JOB",
        sizeBytes: 12_864,
        status: "ACTIVE",
      })
      .onConflictDoNothing();
  }
  const importJobId = `${SEED_PREFIX}import-students-completed`;
  await database
    .insert(importJobs)
    .values({
      checkpointRow: 4,
      checksum: await checksumFor(importJobId),
      committedAt: at("2026-08-05T08:00:00"),
      createdAt: at("2026-08-05T07:00:00"),
      createdBy: adminAcademicId,
      entityType: "STUDENT",
      errorCount: 1,
      fileObjectId: importFileId,
      filename: "mahasiswa-2026-09-28.csv",
      id: importJobId,
      invalidCount: 1,
      processedRows: 4,
      status: "PARTIAL_FAILED",
      templateVersion: "master-data-v1",
      totalRows: 4,
      validCount: 2,
      warningCount: 1,
    })
    .onConflictDoNothing();
  await database
    .insert(importRows)
    .values([
      {
        commitError: null,
        commitStatus: "COMMITTED",
        createdAt: at("2026-08-05T07:05:00"),
        entityId: studentRows[0]?.id ?? null,
        errors: null,
        id: `${importJobId}-row-1`,
        jobId: importJobId,
        normalizedData: JSON.stringify({
          name: studentRows[0]?.name,
          nim: studentRows[0]?.nim,
        }),
        rawData: JSON.stringify({
          name: studentRows[0]?.name,
          nim: studentRows[0]?.nim,
        }),
        rowNumber: 1,
        status: "VALID",
      },
      {
        commitError: null,
        commitStatus: "COMMITTED",
        createdAt: at("2026-08-05T07:05:00"),
        entityId: studentRows[1]?.id ?? null,
        errors: JSON.stringify([
          "Nomor telepon tidak dicantumkan pada berkas sumber.",
        ]),
        id: `${importJobId}-row-2`,
        jobId: importJobId,
        normalizedData: JSON.stringify({
          name: studentRows[1]?.name,
          nim: studentRows[1]?.nim,
        }),
        rawData: JSON.stringify({
          name: studentRows[1]?.name,
          nim: studentRows[1]?.nim,
        }),
        rowNumber: 2,
        status: "WARNING",
      },
      {
        commitError: "NIM telah digunakan oleh mahasiswa lain.",
        commitStatus: "FAILED",
        createdAt: at("2026-08-05T07:05:00"),
        entityId: null,
        errors: JSON.stringify(["NIM duplikat."]),
        id: `${importJobId}-row-3`,
        jobId: importJobId,
        normalizedData: null,
        rawData: JSON.stringify({
          name: "Nama Baris Ditolak",
          nim: studentRows[0]?.nim,
        }),
        rowNumber: 3,
        status: "INVALID",
      },
    ])
    .onConflictDoNothing();

  await database
    .insert(auditLogs)
    .values([
      {
        action: "IMPORT_CREATE",
        actorUserId: adminAcademicId,
        afterState: JSON.stringify({
          filename: "mahasiswa-2026-09-28.csv",
          status: "PARTIAL_FAILED",
        }),
        beforeState: null,
        createdAt: at("2026-08-05T07:00:00"),
        entityId: importJobId,
        entityType: "IMPORT_JOB",
        id: `${SEED_PREFIX}audit-import-create`,
        metadata: JSON.stringify({ templateVersion: "master-data-v1" }),
        requestId: `${SEED_PREFIX}request-import-create`,
      },
      {
        action: "UPDATE",
        actorUserId: superadmin.userId,
        afterState: JSON.stringify({ status: "PUBLISHED", version: 1 }),
        beforeState: JSON.stringify({ status: "APPROVED", version: 0 }),
        createdAt: at("2026-08-16T07:00:00"),
        entityId: `${SEED_PREFIX}schedule-draft-kwu`,
        entityType: "SCHEDULE_DRAFT",
        id: `${SEED_PREFIX}audit-schedule-published`,
        metadata: JSON.stringify({ source: "seed-data" }),
        requestId: `${SEED_PREFIX}request-schedule-published`,
      },
    ])
    .onConflictDoNothing();
  await database
    .insert(notifications)
    .values([
      {
        body: "Terdapat satu permohonan perubahan presensi yang menunggu tinjauan.",
        createdAt: at("2026-09-19T07:00:00"),
        id: `${SEED_PREFIX}notification-admin-attendance`,
        readAt: null,
        route: "/admin-akademik/presensi",
        status: "UNREAD",
        title: "Permohonan presensi baru",
        type: "ATTENDANCE_REVIEW",
        userId: adminAcademicId,
      },
      {
        body: "Nilai mata kuliah sudah dipublikasikan untuk periode aktif.",
        createdAt: at("2026-12-24T09:00:00"),
        id: `${SEED_PREFIX}notification-superadmin-grades`,
        readAt: at("2026-12-25T07:00:00"),
        route: "/superadmin/nilai",
        status: "READ",
        title: "Publikasi nilai selesai",
        type: "GRADE_PUBLICATION",
        userId: superadmin.userId,
      },
    ])
    .onConflictDoNothing();
  await database
    .insert(outboxEvents)
    .values([
      {
        aggregateId: importJobId,
        aggregateType: "IMPORT_JOB",
        attempts: 0,
        availableAt: at("2026-08-05T08:05:00"),
        createdAt: at("2026-08-05T08:00:00"),
        eventType: "IMPORT_COMMITTED",
        id: `${SEED_PREFIX}outbox-import-committed`,
        lastError: null,
        payload: JSON.stringify({ entityType: "STUDENT", jobId: importJobId }),
        processedAt: at("2026-08-05T08:06:00"),
        status: "COMPLETED",
      },
      {
        aggregateId: `${SEED_PREFIX}section-kwu-101`,
        aggregateType: "CLASS_SECTION",
        attempts: 1,
        availableAt: now,
        createdAt: now,
        eventType: "GRADE_PUBLICATION_NOTIFICATION",
        id: `${SEED_PREFIX}outbox-grade-notification`,
        lastError:
          "Pengiriman email ditunda karena worker development tidak aktif.",
        payload: JSON.stringify({
          classSectionId: `${SEED_PREFIX}section-kwu-101`,
        }),
        processedAt: null,
        status: "PENDING",
      },
    ])
    .onConflictDoNothing();
  await database
    .insert(backgroundJobs)
    .values([
      {
        completedCount: 12,
        createdAt: at("2026-12-24T09:05:00"),
        cursor: null,
        errorCount: 0,
        errorMessage: null,
        id: `${SEED_PREFIX}background-job-grade-notification-completed`,
        idempotencyKey: `${SEED_PREFIX}background-job-grade-notification-key`,
        jobType: "GRADE_PUBLICATION_NOTIFICATION",
        leaseExpiresAt: null,
        leaseOwner: null,
        processedCount: 12,
        status: "COMPLETED",
        totalCount: 12,
        updatedAt: at("2026-12-24T09:10:00"),
      },
      {
        completedCount: 3,
        createdAt: now,
        cursor: "3",
        errorCount: 1,
        errorMessage:
          "Object storage belum tersedia pada environment development.",
        id: `${SEED_PREFIX}background-job-file-reconciliation`,
        idempotencyKey: `${SEED_PREFIX}background-job-file-reconciliation-key`,
        jobType: "FILE_RECONCILIATION",
        leaseExpiresAt: plusDays(now, 1),
        leaseOwner: "worker-development-01",
        processedCount: 4,
        status: "PARTIAL_FAILED",
        totalCount: 6,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing();
  await database
    .insert(idempotencyKeys)
    .values({
      actorUserId: adminAcademicId,
      createdAt: at("2026-08-05T07:00:00"),
      expiresAt: plusDays(at("2026-08-05T07:00:00"), 1),
      id: `${SEED_PREFIX}idempotency-import-create`,
      key: `${SEED_PREFIX}import-create-key`,
      requestHash: await checksumFor(`${SEED_PREFIX}import-create-request`),
      resultReference: importJobId,
      scope: "master-data.import.create",
      status: "COMPLETED",
    })
    .onConflictDoNothing();
  await database
    .insert(securityEvents)
    .values([
      {
        createdAt: at("2026-09-28T07:00:00"),
        eventType: "LOGIN_SUCCEEDED",
        id: `${SEED_PREFIX}security-login-superadmin`,
        ipAddress: "127.0.0.1",
        metadata: JSON.stringify({ identifier: superadmin.identifier }),
        requestId: `${SEED_PREFIX}request-login-superadmin`,
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0",
        userId: superadmin.userId,
      },
      {
        createdAt: at("2026-09-27T07:00:00"),
        eventType: "PASSWORD_RESET_REQUESTED",
        id: `${SEED_PREFIX}security-password-reset`,
        ipAddress: "127.0.0.1",
        metadata: JSON.stringify({ identifier: "AKD20260928001" }),
        requestId: `${SEED_PREFIX}request-password-reset`,
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0",
        userId: adminAcademicId,
      },
    ])
    .onConflictDoNothing();

  return {
    accountCount:
      3 +
      lecturerRows.length +
      studentDefinitions.filter(
        (student) => student.academicStatus === "ACTIVE"
      ).length,
    courseCount: courseRows.length,
    identifiers: [
      superadmin.identifier,
      "AKD20260928001",
      "KEU20260928001",
      ...lecturerRows.map((lecturer) => lecturer.dsn),
      ...studentDefinitions
        .filter((student) => student.academicStatus === "ACTIVE")
        .map((student) => student.nim),
    ],
    lecturerCount: lecturerRows.length,
    programCount: programs.length,
    studentCount: studentRows.length,
  };
};

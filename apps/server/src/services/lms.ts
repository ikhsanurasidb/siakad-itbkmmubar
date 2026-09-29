import type { FileStorage } from "@server/services/storage";
import {
  createPrivateObjectKey,
  validateFileMetadata,
} from "@server/services/storage";
import type { LmsService } from "@siakad-itbkmmubar/api/context";
import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import {
  LmsDomainError,
  assertLmsManageRole,
  assertLmsReadRole,
  decodeLmsCursor,
  determineSubmissionStatus,
  encodeLmsCursor,
  normalizeLmsBody,
  normalizeLmsTitle,
} from "@siakad-itbkmmubar/api/lms";
import type {
  LmsAssignmentRecord,
  LmsFileInput,
  LmsFileRecord,
  LmsForumPostRecord,
  LmsForumThreadRecord,
  LmsMaterialRecord,
  LmsSubmissionRecord,
} from "@siakad-itbkmmubar/api/lms";
import type { Database } from "@siakad-itbkmmubar/db";
import {
  identityAccounts,
  programHeads,
} from "@siakad-itbkmmubar/db/schema/identity";
import {
  assignmentFiles,
  assignmentSubmissions,
  assignments,
  forumPosts,
  forumThreads,
  learningMaterials,
  materialFiles,
  submissionFiles,
} from "@siakad-itbkmmubar/db/schema/lms";
import { lecturers, students } from "@siakad-itbkmmubar/db/schema/master-data";
import {
  fileObjects,
  notifications,
} from "@siakad-itbkmmubar/db/schema/platform";
import {
  classEnrollments,
  classMeetings,
  classSections,
  teachingAssignments,
} from "@siakad-itbkmmubar/db/schema/scheduling";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  max,
  or,
} from "drizzle-orm";

interface LmsActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

interface UploadedFile {
  file: LmsFileRecord;
  objectKey: string;
  value: Uint8Array;
}

const MAX_FILE_BYTES = 25 * 1_000_000;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const toIso = (date: Date): string => date.toISOString();

const decodeBase64 = (content: string): Uint8Array => {
  const normalized = content.trim();
  if (!normalized || normalized.includes(",")) {
    throw new LmsDomainError("INVALID_FILE_CONTENT", "Isi berkas tidak valid.");
  }
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.codePointAt(index) ?? 0;
    }
    return bytes;
  } catch {
    throw new LmsDomainError("INVALID_FILE_CONTENT", "Isi berkas tidak valid.");
  }
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isAdmin = (roles: readonly RoleKey[]): boolean =>
  roles.includes("SUPERADMIN") || roles.includes("ADMIN_AKADEMIK");

const isStudent = (roles: readonly RoleKey[]): boolean =>
  roles.includes("MAHASISWA") && !isAdmin(roles);

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const prepareFiles = (
  files: readonly LmsFileInput[] | undefined,
  namespace: string,
  ownerId: string
): UploadedFile[] => {
  const prepared: UploadedFile[] = [];
  for (const input of files ?? []) {
    const bytes = decodeBase64(input.contentBase64);
    const metadata = validateFileMetadata(
      {
        declaredMime: input.declaredMime,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: bytes.byteLength,
      },
      { allowedMimeTypes: ALLOWED_FILE_TYPES, maxBytes: MAX_FILE_BYTES }
    );
    prepared.push({
      file: {
        fileObjectId: createUuidV7(),
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
      },
      objectKey: createPrivateObjectKey(namespace, ownerId),
      value: bytes,
    });
  }
  return prepared;
};

const postRecord = (
  row: typeof forumPosts.$inferSelect
): LmsForumPostRecord => ({
  authorId: row.authorId,
  body: row.deletedAt ? "Pesan dihapus." : row.body,
  createdAt: toIso(row.createdAt),
  editedAt: row.editedAt ? toIso(row.editedAt) : null,
  id: row.id,
});

export const createLmsService = ({
  database,
  now = () => new Date(),
  storage,
}: {
  database: Database;
  now?: () => Date;
  storage: FileStorage;
}): LmsService => {
  const getSection = async (classSectionId: string) => {
    const [section] = await database
      .select({
        id: classSections.id,
        status: classSections.status,
        studyProgramId: classSections.studyProgramId,
      })
      .from(classSections)
      .where(eq(classSections.id, classSectionId))
      .limit(1);
    if (!section) {
      throw new LmsDomainError("CLASS_NOT_FOUND", "Kelas tidak ditemukan.");
    }
    return section;
  };

  const getMeeting = async (
    classSectionId: string,
    classMeetingId?: string
  ) => {
    if (!classMeetingId) {
      return null;
    }
    const [meeting] = await database
      .select({
        classSectionId: classMeetings.classSectionId,
        id: classMeetings.id,
      })
      .from(classMeetings)
      .where(
        and(
          eq(classMeetings.id, classMeetingId),
          eq(classMeetings.classSectionId, classSectionId)
        )
      )
      .limit(1);
    if (!meeting) {
      throw new LmsDomainError(
        "MEETING_NOT_FOUND",
        "Pertemuan tidak ditemukan."
      );
    }
    return meeting;
  };

  const getActorStudent = async (actorUserId: string) => {
    const [row] = await database
      .select({ student: students })
      .from(identityAccounts)
      .innerJoin(students, eq(students.nim, identityAccounts.identifier))
      .where(eq(identityAccounts.userId, actorUserId))
      .limit(1);
    return row?.student ?? null;
  };

  const canAccessSection = async (
    actor: LmsActor,
    classSectionId: string,
    requireManager = false
  ): Promise<{ studentId: string | null }> => {
    assertLmsReadRole(actor.actorRoles);
    const section = await getSection(classSectionId);
    if (isAdmin(actor.actorRoles)) {
      return { studentId: null };
    }
    if (actor.actorRoles.includes("KAPRODI")) {
      const [programHead] = await database
        .select({ id: programHeads.id })
        .from(programHeads)
        .where(
          and(
            eq(programHeads.prodiId, section.studyProgramId),
            eq(programHeads.userId, actor.actorUserId),
            lte(programHeads.startsAt, now()),
            or(isNull(programHeads.endsAt), gt(programHeads.endsAt, now()))
          )
        )
        .limit(1);
      if (programHead) {
        return { studentId: null };
      }
    }
    if (actor.actorRoles.includes("DOSEN")) {
      const rows = await database
        .select({ id: teachingAssignments.id })
        .from(identityAccounts)
        .innerJoin(lecturers, eq(lecturers.dsn, identityAccounts.identifier))
        .innerJoin(
          teachingAssignments,
          eq(teachingAssignments.lecturerId, lecturers.id)
        )
        .where(
          and(
            eq(identityAccounts.userId, actor.actorUserId),
            eq(teachingAssignments.classSectionId, classSectionId)
          )
        )
        .limit(1);
      if (rows.length > 0) {
        return { studentId: null };
      }
    }
    if (isStudent(actor.actorRoles)) {
      const student = await getActorStudent(actor.actorUserId);
      if (student) {
        const [enrollment] = await database
          .select({ id: classEnrollments.id })
          .from(classEnrollments)
          .where(
            and(
              eq(classEnrollments.classSectionId, classSectionId),
              eq(classEnrollments.studentId, student.id)
            )
          )
          .limit(1);
        if (enrollment) {
          return { studentId: student.id };
        }
      }
    }
    throw new LmsDomainError(
      requireManager ? "MANAGE_ACCESS_DENIED" : "CLASS_ACCESS_DENIED",
      requireManager
        ? "Anda bukan dosen pengampu kelas ini."
        : "Anda tidak terdaftar pada kelas ini."
    );
  };

  const ensureManager = async (actor: LmsActor, classSectionId: string) => {
    assertLmsManageRole(actor.actorRoles);
    if (isAdmin(actor.actorRoles)) {
      await getSection(classSectionId);
      return;
    }
    await canAccessSection(actor, classSectionId, true);
    if (
      !actor.actorRoles.includes("DOSEN") &&
      !actor.actorRoles.includes("KAPRODI")
    ) {
      throw new LmsDomainError(
        "MANAGE_ACCESS_DENIED",
        "Akses pengelolaan ditolak."
      );
    }
  };

  const uploadPrepared = async (prepared: readonly UploadedFile[]) => {
    const results = await Promise.allSettled(
      prepared.map((item) =>
        storage.put(item.objectKey, item.value, {
          httpMetadata: { contentType: item.file.mimeType },
        })
      )
    );
    const uploaded = prepared.filter(
      (_, index) => results[index]?.status === "fulfilled"
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      await Promise.all(uploaded.map((item) => storage.delete(item.objectKey)));
      throw failed.reason;
    }
    return prepared;
  };

  const fileRows = async (
    fileIds: readonly string[]
  ): Promise<LmsFileRecord[]> => {
    if (fileIds.length === 0) {
      return [];
    }
    const rows = await database
      .select({ file: fileObjects })
      .from(fileObjects)
      .where(
        and(
          inArray(fileObjects.id, [...fileIds]),
          eq(fileObjects.status, "ACTIVE")
        )
      );
    return rows.map(({ file }) => ({
      fileObjectId: file.id,
      filename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    }));
  };

  const materialFilesFor = async (materialId: string) => {
    const rows = await database
      .select({ fileObjectId: materialFiles.fileObjectId })
      .from(materialFiles)
      .where(eq(materialFiles.materialId, materialId));
    return fileRows(rows.map((row) => row.fileObjectId));
  };

  const assignmentFilesFor = async (assignmentId: string) => {
    const rows = await database
      .select({ fileObjectId: assignmentFiles.fileObjectId })
      .from(assignmentFiles)
      .where(eq(assignmentFiles.assignmentId, assignmentId));
    return fileRows(rows.map((row) => row.fileObjectId));
  };

  const submissionFilesFor = async (submissionId: string) => {
    const rows = await database
      .select({ fileObjectId: submissionFiles.fileObjectId })
      .from(submissionFiles)
      .where(eq(submissionFiles.submissionId, submissionId));
    return fileRows(rows.map((row) => row.fileObjectId));
  };

  const materialRecord = async (
    row: typeof learningMaterials.$inferSelect
  ): Promise<LmsMaterialRecord> => ({
    body: row.body,
    classMeetingId: row.classMeetingId,
    classSectionId: row.classSectionId,
    createdAt: toIso(row.createdAt),
    createdBy: row.createdBy,
    files: await materialFilesFor(row.id),
    id: row.id,
    status: row.status as "DRAFT" | "PUBLISHED",
    title: row.title,
    updatedAt: toIso(row.updatedAt),
    version: row.version,
  });

  const assignmentRecord = async (
    row: typeof assignments.$inferSelect
  ): Promise<LmsAssignmentRecord> => ({
    allowResubmit: row.allowResubmit,
    body: row.body,
    classMeetingId: row.classMeetingId,
    classSectionId: row.classSectionId,
    createdAt: toIso(row.createdAt),
    createdBy: row.createdBy,
    dueAt: toIso(row.dueAt),
    files: await assignmentFilesFor(row.id),
    id: row.id,
    status: row.status as "DRAFT" | "PUBLISHED",
    title: row.title,
    updatedAt: toIso(row.updatedAt),
    version: row.version,
  });

  const threadRecord = async (
    row: typeof forumThreads.$inferSelect
  ): Promise<LmsForumThreadRecord> => {
    const posts = await database
      .select()
      .from(forumPosts)
      .where(eq(forumPosts.threadId, row.id))
      .orderBy(asc(forumPosts.createdAt));
    return {
      classMeetingId: row.classMeetingId,
      classSectionId: row.classSectionId,
      createdAt: toIso(row.createdAt),
      createdBy: row.createdBy,
      id: row.id,
      posts: posts.map(postRecord),
      status: row.status as "OPEN" | "CLOSED",
      title: row.title,
      updatedAt: toIso(row.updatedAt),
    };
  };

  const notifyClass = async (
    classSectionId: string,
    title: string,
    body: string
  ) => {
    const enrolled = await database
      .select({ userId: identityAccounts.userId })
      .from(classEnrollments)
      .innerJoin(students, eq(students.id, classEnrollments.studentId))
      .innerJoin(
        identityAccounts,
        eq(identityAccounts.identifier, students.nim)
      )
      .where(eq(classEnrollments.classSectionId, classSectionId));
    const userIds = unique(enrolled.map((row) => row.userId));
    if (userIds.length > 0) {
      await database.insert(notifications).values(
        userIds.map((userId) => ({
          body,
          id: createUuidV7(),
          route: `/mahasiswa/kelas/${classSectionId}/lms`,
          title,
          type: "LMS",
          userId,
        }))
      );
    }
  };

  const createMaterial: LmsService["createMaterial"] = async (input) => {
    await ensureManager(input, input.classSectionId);
    await getMeeting(input.classSectionId, input.classMeetingId);
    const currentTime = now();
    const id = createUuidV7();
    const prepared = await prepareFiles(input.files, "lms/materials", id);
    const uploaded = await uploadPrepared(prepared);
    const checksums = new Map(
      await Promise.all(
        uploaded.map(
          async (item) =>
            [item.file.fileObjectId, await sha256(item.value)] as const
        )
      )
    );
    try {
      await database.batch([
        database.insert(learningMaterials).values({
          body: normalizeLmsBody(input.body),
          classMeetingId: input.classMeetingId ?? null,
          classSectionId: input.classSectionId,
          createdAt: currentTime,
          createdBy: input.actorUserId,
          id,
          status: "DRAFT",
          title: normalizeLmsTitle(input.title),
          updatedAt: currentTime,
          version: 0,
        }),
        ...uploaded.flatMap((item) => [
          database.insert(fileObjects).values({
            checksum: checksums.get(item.file.fileObjectId) ?? "",
            createdAt: currentTime,
            createdBy: input.actorUserId,
            declaredMime: null,
            id: item.file.fileObjectId,
            mimeType: item.file.mimeType,
            objectKey: item.objectKey,
            originalFilename: item.file.filename,
            ownerId: id,
            ownerType: "LMS_MATERIAL",
            sizeBytes: item.file.sizeBytes,
            status: "ACTIVE",
          }),
          database.insert(materialFiles).values({
            createdAt: currentTime,
            fileObjectId: item.file.fileObjectId,
            id: createUuidV7(),
            materialId: id,
          }),
        ]),
      ] as Parameters<Database["batch"]>[0]);
    } catch (error) {
      await Promise.all(uploaded.map((item) => storage.delete(item.objectKey)));
      throw error;
    }
    const [row] = await database
      .select()
      .from(learningMaterials)
      .where(eq(learningMaterials.id, id));
    if (!row) {
      throw new LmsDomainError("MATERIAL_NOT_FOUND", "Materi tidak ditemukan.");
    }
    return materialRecord(row);
  };

  const createAssignment: LmsService["createAssignment"] = async (input) => {
    await ensureManager(input, input.classSectionId);
    await getMeeting(input.classSectionId, input.classMeetingId);
    if (Number.isNaN(input.dueAt.getTime())) {
      throw new LmsDomainError(
        "INVALID_DUE_DATE",
        "Batas pengumpulan tidak valid."
      );
    }
    const currentTime = now();
    const id = createUuidV7();
    const prepared = await prepareFiles(input.files, "lms/assignments", id);
    const uploaded = await uploadPrepared(prepared);
    const checksums = new Map(
      await Promise.all(
        uploaded.map(
          async (item) =>
            [item.file.fileObjectId, await sha256(item.value)] as const
        )
      )
    );
    try {
      await database.batch([
        database.insert(assignments).values({
          allowResubmit: input.allowResubmit ?? false,
          body: normalizeLmsBody(input.body),
          classMeetingId: input.classMeetingId ?? null,
          classSectionId: input.classSectionId,
          createdAt: currentTime,
          createdBy: input.actorUserId,
          dueAt: input.dueAt,
          id,
          status: "DRAFT",
          title: normalizeLmsTitle(input.title),
          updatedAt: currentTime,
          version: 0,
        }),
        ...uploaded.flatMap((item) => [
          database.insert(fileObjects).values({
            checksum: checksums.get(item.file.fileObjectId) ?? "",
            createdAt: currentTime,
            createdBy: input.actorUserId,
            declaredMime: null,
            id: item.file.fileObjectId,
            mimeType: item.file.mimeType,
            objectKey: item.objectKey,
            originalFilename: item.file.filename,
            ownerId: id,
            ownerType: "LMS_ASSIGNMENT",
            sizeBytes: item.file.sizeBytes,
            status: "ACTIVE",
          }),
          database.insert(assignmentFiles).values({
            assignmentId: id,
            createdAt: currentTime,
            fileObjectId: item.file.fileObjectId,
            id: createUuidV7(),
          }),
        ]),
      ] as Parameters<Database["batch"]>[0]);
    } catch (error) {
      await Promise.all(uploaded.map((item) => storage.delete(item.objectKey)));
      throw error;
    }
    const [row] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, id));
    if (!row) {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    return assignmentRecord(row);
  };

  const detail: LmsService["detail"] = async (input) => {
    const access = await canAccessSection(input, input.classSectionId);
    await getMeeting(input.classSectionId, input.classMeetingId);
    const studentVisible = access.studentId !== null;
    const materialRows = await database
      .select()
      .from(learningMaterials)
      .where(
        and(
          eq(learningMaterials.classSectionId, input.classSectionId),
          ...(input.classMeetingId
            ? [eq(learningMaterials.classMeetingId, input.classMeetingId)]
            : []),
          ...(studentVisible ? [eq(learningMaterials.status, "PUBLISHED")] : [])
        )
      )
      .orderBy(desc(learningMaterials.updatedAt));
    const assignmentRows = await database
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.classSectionId, input.classSectionId),
          ...(input.classMeetingId
            ? [eq(assignments.classMeetingId, input.classMeetingId)]
            : []),
          ...(studentVisible ? [eq(assignments.status, "PUBLISHED")] : [])
        )
      )
      .orderBy(desc(assignments.dueAt));
    const threadRows = await database
      .select()
      .from(forumThreads)
      .where(
        input.classMeetingId
          ? and(
              eq(forumThreads.classSectionId, input.classSectionId),
              eq(forumThreads.classMeetingId, input.classMeetingId)
            )
          : eq(forumThreads.classSectionId, input.classSectionId)
      )
      .orderBy(desc(forumThreads.updatedAt));
    return {
      assignments: await Promise.all(assignmentRows.map(assignmentRecord)),
      classSectionId: input.classSectionId,
      materials: await Promise.all(materialRows.map(materialRecord)),
      threads: await Promise.all(threadRows.map(threadRecord)),
    };
  };

  const listThreads: LmsService["listThreads"] = async (input) => {
    await canAccessSection(input, input.classSectionId);
    const conditions = [eq(forumThreads.classSectionId, input.classSectionId)];
    if (input.classMeetingId) {
      conditions.push(eq(forumThreads.classMeetingId, input.classMeetingId));
    }
    if (input.cursor) {
      const cursor = decodeLmsCursor(input.cursor);
      const cursorCondition = or(
        lt(forumThreads.createdAt, cursor.createdAt),
        and(
          eq(forumThreads.createdAt, cursor.createdAt),
          lt(forumThreads.id, cursor.id)
        )
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
    const limit = Math.min(input.limit ?? 20, 50);
    const rows = await database
      .select()
      .from(forumThreads)
      .where(and(...conditions))
      .orderBy(desc(forumThreads.createdAt), desc(forumThreads.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: await Promise.all(page.map(threadRecord)),
      nextCursor:
        rows.length > limit && last
          ? encodeLmsCursor(last.createdAt, last.id)
          : null,
    };
  };

  const updateMaterial: LmsService["updateMaterial"] = async (input) => {
    const [row] = await database
      .select()
      .from(learningMaterials)
      .where(eq(learningMaterials.id, input.materialId));
    if (!row) {
      throw new LmsDomainError("MATERIAL_NOT_FOUND", "Materi tidak ditemukan.");
    }
    await ensureManager(input, row.classSectionId);
    if (row.status !== "DRAFT" || row.version !== input.expectedVersion) {
      throw new LmsDomainError(
        "STALE_CONTENT",
        "Materi berubah atau sudah diterbitkan."
      );
    }
    await database
      .update(learningMaterials)
      .set({
        body: normalizeLmsBody(input.body),
        title: normalizeLmsTitle(input.title),
        updatedAt: now(),
        version: row.version + 1,
      })
      .where(
        and(
          eq(learningMaterials.id, input.materialId),
          eq(learningMaterials.status, "DRAFT"),
          eq(learningMaterials.version, input.expectedVersion)
        )
      );
    const [updated] = await database
      .select()
      .from(learningMaterials)
      .where(eq(learningMaterials.id, input.materialId));
    if (!updated) {
      throw new LmsDomainError("MATERIAL_NOT_FOUND", "Materi tidak ditemukan.");
    }
    return materialRecord(updated);
  };

  const updateAssignment: LmsService["updateAssignment"] = async (input) => {
    const [row] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId));
    if (!row) {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    await ensureManager(input, row.classSectionId);
    if (
      row.status !== "DRAFT" ||
      row.version !== input.expectedVersion ||
      Number.isNaN(input.dueAt.getTime())
    ) {
      throw new LmsDomainError(
        "STALE_CONTENT",
        "Tugas berubah, sudah diterbitkan, atau batas waktunya tidak valid."
      );
    }
    await database
      .update(assignments)
      .set({
        allowResubmit: input.allowResubmit ?? row.allowResubmit,
        body: normalizeLmsBody(input.body),
        dueAt: input.dueAt,
        title: normalizeLmsTitle(input.title),
        updatedAt: now(),
        version: row.version + 1,
      })
      .where(
        and(
          eq(assignments.id, input.assignmentId),
          eq(assignments.status, "DRAFT"),
          eq(assignments.version, input.expectedVersion)
        )
      );
    const [updated] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId));
    if (!updated) {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    return assignmentRecord(updated);
  };

  const publishMaterial: LmsService["publishMaterial"] = async (input) => {
    const [row] = await database
      .select()
      .from(learningMaterials)
      .where(eq(learningMaterials.id, input.materialId));
    if (!row) {
      throw new LmsDomainError("MATERIAL_NOT_FOUND", "Materi tidak ditemukan.");
    }
    await ensureManager(input, row.classSectionId);
    if (row.version !== input.expectedVersion || row.status !== "DRAFT") {
      throw new LmsDomainError(
        "STALE_CONTENT",
        "Materi berubah. Muat ulang sebelum menerbitkan."
      );
    }
    const currentTime = now();
    await database
      .update(learningMaterials)
      .set({
        publishedAt: currentTime,
        publishedBy: input.actorUserId,
        status: "PUBLISHED",
        updatedAt: currentTime,
        version: row.version + 1,
      })
      .where(
        and(
          eq(learningMaterials.id, input.materialId),
          eq(learningMaterials.version, input.expectedVersion),
          eq(learningMaterials.status, "DRAFT")
        )
      );
    await notifyClass(row.classSectionId, "Materi baru tersedia", row.title);
  };

  const publishAssignment: LmsService["publishAssignment"] = async (input) => {
    const [row] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId));
    if (!row) {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    await ensureManager(input, row.classSectionId);
    if (row.version !== input.expectedVersion || row.status !== "DRAFT") {
      throw new LmsDomainError(
        "STALE_CONTENT",
        "Tugas berubah. Muat ulang sebelum menerbitkan."
      );
    }
    const currentTime = now();
    await database
      .update(assignments)
      .set({
        publishedAt: currentTime,
        publishedBy: input.actorUserId,
        status: "PUBLISHED",
        updatedAt: currentTime,
        version: row.version + 1,
      })
      .where(
        and(
          eq(assignments.id, input.assignmentId),
          eq(assignments.version, input.expectedVersion),
          eq(assignments.status, "DRAFT")
        )
      );
    await notifyClass(row.classSectionId, "Tugas baru tersedia", row.title);
  };

  const submitAssignment: LmsService["submitAssignment"] = async (input) => {
    const [assignment] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId));
    if (!assignment || assignment.status !== "PUBLISHED") {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    const access = await canAccessSection(input, assignment.classSectionId);
    if (!access.studentId) {
      throw new LmsDomainError(
        "STUDENT_REQUIRED",
        "Submission hanya dapat dikirim mahasiswa."
      );
    }
    const [latest] = await database
      .select({ latestVersion: max(assignmentSubmissions.version) })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignment.id),
          eq(assignmentSubmissions.studentId, access.studentId)
        )
      );
    const nextVersion = Number(latest?.latestVersion ?? 0) + 1;
    if (nextVersion > 1 && !assignment.allowResubmit) {
      throw new LmsDomainError(
        "RESUBMIT_NOT_ALLOWED",
        "Tugas ini tidak menerima pengumpulan ulang."
      );
    }
    const currentTime = now();
    const status = determineSubmissionStatus(currentTime, assignment.dueAt);
    const id = createUuidV7();
    const prepared = await prepareFiles(input.files, "lms/submissions", id);
    const uploaded = await uploadPrepared(prepared);
    const checksums = new Map(
      await Promise.all(
        uploaded.map(
          async (item) =>
            [item.file.fileObjectId, await sha256(item.value)] as const
        )
      )
    );
    try {
      await database.batch([
        database.insert(assignmentSubmissions).values({
          assignmentId: assignment.id,
          body: normalizeLmsBody(input.body),
          createdAt: currentTime,
          id,
          isLate: status.isLate,
          status: status.status,
          studentId: access.studentId,
          submittedAt: currentTime,
          version: nextVersion,
        }),
        ...uploaded.flatMap((item) => [
          database.insert(fileObjects).values({
            checksum: checksums.get(item.file.fileObjectId) ?? "",
            createdAt: currentTime,
            createdBy: input.actorUserId,
            declaredMime: null,
            id: item.file.fileObjectId,
            mimeType: item.file.mimeType,
            objectKey: item.objectKey,
            originalFilename: item.file.filename,
            ownerId: id,
            ownerType: "LMS_SUBMISSION",
            sizeBytes: item.file.sizeBytes,
            status: "ACTIVE",
          }),
          database.insert(submissionFiles).values({
            createdAt: currentTime,
            fileObjectId: item.file.fileObjectId,
            id: createUuidV7(),
            submissionId: id,
          }),
        ]),
      ] as Parameters<Database["batch"]>[0]);
    } catch (error) {
      await Promise.all(uploaded.map((item) => storage.delete(item.objectKey)));
      throw error;
    }
    const [row] = await database
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, id));
    if (!row) {
      throw new LmsDomainError(
        "SUBMISSION_NOT_FOUND",
        "Submission tidak ditemukan."
      );
    }
    return {
      assignmentId: row.assignmentId,
      body: row.body,
      files: await submissionFilesFor(row.id),
      id: row.id,
      isLate: row.isLate,
      status: row.status as "SUBMITTED" | "LATE",
      studentId: row.studentId,
      submittedAt: toIso(row.submittedAt),
      version: row.version,
    };
  };

  const listSubmissions: LmsService["listSubmissions"] = async (input) => {
    const [assignment] = await database
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId));
    if (!assignment) {
      throw new LmsDomainError(
        "ASSIGNMENT_NOT_FOUND",
        "Tugas tidak ditemukan."
      );
    }
    await ensureManager(input, assignment.classSectionId);
    const rows = await database
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, input.assignmentId))
      .orderBy(desc(assignmentSubmissions.submittedAt));
    return Promise.all(
      rows.map(async (row): Promise<LmsSubmissionRecord> => ({
        assignmentId: row.assignmentId,
        body: row.body,
        files: await submissionFilesFor(row.id),
        id: row.id,
        isLate: row.isLate,
        status: row.status as "SUBMITTED" | "LATE",
        studentId: row.studentId,
        submittedAt: toIso(row.submittedAt),
        version: row.version,
      }))
    );
  };

  const createThread: LmsService["createThread"] = async (input) => {
    await canAccessSection(input, input.classSectionId);
    await getMeeting(input.classSectionId, input.classMeetingId);
    const currentTime = now();
    const id = createUuidV7();
    await database.batch([
      database.insert(forumThreads).values({
        classMeetingId: input.classMeetingId ?? null,
        classSectionId: input.classSectionId,
        createdAt: currentTime,
        createdBy: input.actorUserId,
        id,
        status: "OPEN",
        title: normalizeLmsTitle(input.title),
        updatedAt: currentTime,
      }),
      database.insert(forumPosts).values({
        authorId: input.actorUserId,
        body: normalizeLmsBody(input.body) ?? "",
        createdAt: currentTime,
        id: createUuidV7(),
        threadId: id,
      }),
    ] as Parameters<Database["batch"]>[0]);
    const [row] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, id));
    if (!row) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    return threadRecord(row);
  };

  const createPost: LmsService["createPost"] = async (input) => {
    const [thread] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, input.threadId));
    if (!thread) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    await canAccessSection(input, thread.classSectionId);
    if (thread.status === "CLOSED") {
      throw new LmsDomainError("THREAD_CLOSED", "Forum ini sudah ditutup.");
    }
    const currentTime = now();
    await database.batch([
      database.insert(forumPosts).values({
        authorId: input.actorUserId,
        body: normalizeLmsBody(input.body) ?? "",
        createdAt: currentTime,
        id: createUuidV7(),
        threadId: input.threadId,
      }),
      database
        .update(forumThreads)
        .set({ updatedAt: currentTime })
        .where(eq(forumThreads.id, input.threadId)),
    ] as Parameters<Database["batch"]>[0]);
    await notifyClass(
      thread.classSectionId,
      "Balasan forum baru",
      thread.title
    );
    const [updated] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, input.threadId));
    if (!updated) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    return threadRecord(updated);
  };

  const closeThread: LmsService["closeThread"] = async (input) => {
    const [thread] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, input.threadId));
    if (!thread) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    await ensureManager(input, thread.classSectionId);
    await database
      .update(forumThreads)
      .set({ status: "CLOSED", updatedAt: now() })
      .where(eq(forumThreads.id, input.threadId));
  };

  const editPost: LmsService["editPost"] = async (input) => {
    const [post] = await database
      .select()
      .from(forumPosts)
      .where(
        and(eq(forumPosts.id, input.postId), isNull(forumPosts.deletedAt))
      );
    if (!post) {
      throw new LmsDomainError(
        "POST_NOT_FOUND",
        "Pesan forum tidak ditemukan."
      );
    }
    const [thread] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, post.threadId));
    if (!thread) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    await canAccessSection(input, thread.classSectionId);
    if (post.authorId !== input.actorUserId) {
      throw new LmsDomainError(
        "POST_OWNERSHIP_REQUIRED",
        "Anda hanya dapat mengubah pesan sendiri."
      );
    }
    await database
      .update(forumPosts)
      .set({ body: normalizeLmsBody(input.body) ?? "", editedAt: now() })
      .where(eq(forumPosts.id, input.postId));
  };

  const deletePost: LmsService["deletePost"] = async (input) => {
    const [post] = await database
      .select()
      .from(forumPosts)
      .where(
        and(eq(forumPosts.id, input.postId), isNull(forumPosts.deletedAt))
      );
    if (!post) {
      throw new LmsDomainError(
        "POST_NOT_FOUND",
        "Pesan forum tidak ditemukan."
      );
    }
    const [thread] = await database
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.id, post.threadId));
    if (!thread) {
      throw new LmsDomainError("THREAD_NOT_FOUND", "Forum tidak ditemukan.");
    }
    await canAccessSection(input, thread.classSectionId);
    if (post.authorId !== input.actorUserId) {
      throw new LmsDomainError(
        "POST_OWNERSHIP_REQUIRED",
        "Anda hanya dapat menghapus pesan sendiri."
      );
    }
    await database
      .update(forumPosts)
      .set({ body: "", deletedAt: now() })
      .where(eq(forumPosts.id, input.postId));
  };

  const downloadFile: LmsService["downloadFile"] = async (input) => {
    const [file] = await database
      .select()
      .from(fileObjects)
      .where(
        and(
          eq(fileObjects.id, input.fileObjectId),
          eq(fileObjects.status, "ACTIVE")
        )
      )
      .limit(1);
    if (!file) {
      throw new LmsDomainError("FILE_NOT_FOUND", "Berkas tidak ditemukan.");
    }
    let classSectionId: string | null = null;
    if (file.ownerType === "LMS_MATERIAL") {
      const [row] = await database
        .select({ classSectionId: learningMaterials.classSectionId })
        .from(learningMaterials)
        .where(eq(learningMaterials.id, file.ownerId))
        .limit(1);
      classSectionId = row?.classSectionId ?? null;
    } else if (file.ownerType === "LMS_ASSIGNMENT") {
      const [row] = await database
        .select({ classSectionId: assignments.classSectionId })
        .from(assignments)
        .where(eq(assignments.id, file.ownerId))
        .limit(1);
      classSectionId = row?.classSectionId ?? null;
    } else if (file.ownerType === "LMS_SUBMISSION") {
      const [row] = await database
        .select({ classSectionId: assignments.classSectionId })
        .from(assignmentSubmissions)
        .innerJoin(
          assignments,
          eq(assignments.id, assignmentSubmissions.assignmentId)
        )
        .where(eq(assignmentSubmissions.id, file.ownerId))
        .limit(1);
      classSectionId = row?.classSectionId ?? null;
    }
    if (!classSectionId) {
      throw new LmsDomainError("FILE_NOT_FOUND", "Berkas tidak ditemukan.");
    }
    await canAccessSection(input, classSectionId);
    const object = await storage.get(file.objectKey);
    if (!object) {
      throw new LmsDomainError("FILE_NOT_FOUND", "Berkas tidak ditemukan.");
    }
    return {
      body: object.body,
      contentType: file.mimeType,
      filename: file.originalFilename,
    };
  };

  return {
    closeThread,
    createAssignment,
    createMaterial,
    createPost,
    createThread,
    deletePost,
    detail,
    downloadFile,
    editPost,
    listSubmissions,
    listThreads,
    publishAssignment,
    publishMaterial,
    submitAssignment,
    updateAssignment,
    updateMaterial,
  };
};

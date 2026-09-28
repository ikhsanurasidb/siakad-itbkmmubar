import {
  assertAttendanceReviewRole,
  assertAttendanceWindowOpen,
  assertCoordinate,
  attendancePolicyVersion,
  calculateAttendanceWindow,
  calculateDistanceMeters,
  participantTypeForRoles,
  AttendanceDomainError,
  validateEvidenceImage,
} from "@api/attendance";
import type {
  AttendanceMeetingRecord,
  AttendanceParticipantType,
  AttendanceStatus,
} from "@api/attendance";
import type { AttendanceService } from "@api/context";
import type { RoleKey } from "@api/identity";
import type { AttendancePolicy } from "@api/settings";
import type { FileStorage } from "@server/services/storage";
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
import {
  identityAccounts,
  programHeads,
} from "@siakad-itbkmmubar/db/schema/identity";
import {
  courses,
  lecturers,
  rooms,
  students,
} from "@siakad-itbkmmubar/db/schema/master-data";
import {
  fileObjects,
  auditLogs,
  idempotencyKeys,
} from "@siakad-itbkmmubar/db/schema/platform";
import {
  classEnrollments,
  classMeetings,
  classSections,
  scheduleRevisions,
  teachingAssignments,
} from "@siakad-itbkmmubar/db/schema/scheduling";
import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

/* eslint-disable no-await-in-loop -- participant scope checks and ALPA checkpoints are intentionally ordered. */

const CAPTURE_ATTEMPT_TTL_MS = 5 * 60_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_EVIDENCE_FILENAME = "presensi.jpg";

interface AttendanceActor {
  actorRoles: readonly RoleKey[];
  actorUserId: string;
}

interface Participant {
  id: string;
  name: string;
  type: AttendanceParticipantType;
}

interface MeetingContext {
  courseName: string;
  meeting: typeof classMeetings.$inferSelect;
  section: typeof classSections.$inferSelect;
  revision: typeof scheduleRevisions.$inferSelect | null;
}

const toIso = (value: Date): string => value.toISOString();

const decodeBase64 = (value: string): Uint8Array => {
  const normalized = value.replace(/^data:[^;]+;base64,/u, "");
  try {
    const binary = atob(normalized);
    return Uint8Array.from(
      binary,
      (character) => character.codePointAt(0) ?? 0
    );
  } catch {
    throw new AttendanceDomainError(
      "INVALID_EVIDENCE_ENCODING",
      "Foto presensi tidak dapat dibaca."
    );
  }
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const sha256Text = (value: string): Promise<string> =>
  sha256(new TextEncoder().encode(value));

const isAcademicManager = (roles: readonly RoleKey[]): boolean =>
  roles.includes("SUPERADMIN") || roles.includes("ADMIN_AKADEMIK");

export const createAttendanceService = ({
  database,
  getAttendancePolicy,
  storage,
  now = () => new Date(),
}: {
  database: Database;
  getAttendancePolicy: () => Promise<AttendancePolicy>;
  storage: FileStorage;
  now?: () => Date;
}): AttendanceService => {
  const getMeetingContext = async (
    meetingId: string
  ): Promise<MeetingContext> => {
    const [row] = await database
      .select({
        courseName: courses.name,
        meeting: classMeetings,
        section: classSections,
      })
      .from(classMeetings)
      .innerJoin(
        classSections,
        eq(classSections.id, classMeetings.classSectionId)
      )
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .where(eq(classMeetings.id, meetingId))
      .limit(1);
    if (!row || row.section.status !== "PUBLISHED") {
      throw new AttendanceDomainError(
        "ATTENDANCE_MEETING_NOT_FOUND",
        "Pertemuan presensi tidak ditemukan."
      );
    }
    const [revision] = await database
      .select()
      .from(scheduleRevisions)
      .where(
        and(
          eq(scheduleRevisions.meetingId, meetingId),
          isNull(scheduleRevisions.effectiveUntil)
        )
      )
      .orderBy(desc(scheduleRevisions.effectiveFrom))
      .limit(1);
    return { ...row, revision: revision ?? null };
  };

  const getParticipant = async (
    actor: AttendanceActor,
    meeting: MeetingContext
  ): Promise<Participant> => {
    const type = participantTypeForRoles(actor.actorRoles);
    if (type === "STUDENT") {
      const [student] = await database
        .select({ id: students.id, name: students.name })
        .from(identityAccounts)
        .innerJoin(students, eq(students.nim, identityAccounts.identifier))
        .where(eq(identityAccounts.userId, actor.actorUserId))
        .limit(1);
      if (!student) {
        throw new AttendanceDomainError(
          "ATTENDANCE_PARTICIPANT_NOT_FOUND",
          "Profil mahasiswa belum tersedia."
        );
      }
      const [enrollment] = await database
        .select({ id: classEnrollments.id })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.classSectionId, meeting.section.id),
            eq(classEnrollments.studentId, student.id)
          )
        )
        .limit(1);
      if (!enrollment) {
        throw new AttendanceDomainError(
          "ATTENDANCE_PARTICIPANT_NOT_ENROLLED",
          "Anda tidak terdaftar pada kelas ini."
        );
      }
      return { ...student, type };
    }

    const [lecturer] = await database
      .select({ id: lecturers.id, name: lecturers.name })
      .from(identityAccounts)
      .innerJoin(lecturers, eq(lecturers.dsn, identityAccounts.identifier))
      .where(eq(identityAccounts.userId, actor.actorUserId))
      .limit(1);
    if (!lecturer) {
      throw new AttendanceDomainError(
        "ATTENDANCE_PARTICIPANT_NOT_FOUND",
        "Profil dosen belum tersedia."
      );
    }
    const [assignment] = await database
      .select({ id: teachingAssignments.id })
      .from(teachingAssignments)
      .where(
        and(
          eq(teachingAssignments.classSectionId, meeting.section.id),
          eq(teachingAssignments.lecturerId, lecturer.id)
        )
      )
      .limit(1);
    if (!assignment) {
      throw new AttendanceDomainError(
        "ATTENDANCE_PARTICIPANT_NOT_ASSIGNED",
        "Anda bukan dosen pengampu kelas ini."
      );
    }
    return { ...lecturer, type };
  };

  const ensureSession = async (
    meeting: MeetingContext
  ): Promise<typeof attendanceSessions.$inferSelect> => {
    const [existing] = await database
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.meetingId, meeting.meeting.id))
      .limit(1);
    if (existing) {
      return existing;
    }
    const policy = await getAttendancePolicy();
    const source = meeting.revision ?? meeting.meeting;
    const window = calculateAttendanceWindow(
      source.startAt,
      source.endAt,
      policy
    );
    const createdAt = now();
    const session = {
      classSectionId: meeting.section.id,
      closeAt: window.closeAt,
      createdAt,
      endAt: source.endAt,
      id: crypto.randomUUID(),
      meetingId: meeting.meeting.id,
      modality: source.modality,
      openAt: window.openAt,
      policyRadiusMeters: policy.radiusMeters,
      policyVersion: attendancePolicyVersion(policy),
      scheduleRevisionId: meeting.revision?.id ?? null,
      startAt: source.startAt,
      updatedAt: createdAt,
    };
    await database
      .insert(attendanceSessions)
      .values(session)
      .onConflictDoNothing();
    const [saved] = await database
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.meetingId, meeting.meeting.id))
      .limit(1);
    if (!saved) {
      throw new AttendanceDomainError(
        "ATTENDANCE_SESSION_CREATE_FAILED",
        "Sesi presensi belum dapat dibuat."
      );
    }
    return saved;
  };

  const ensureReviewScope = async (
    actor: AttendanceActor,
    section: typeof classSections.$inferSelect
  ): Promise<void> => {
    assertAttendanceReviewRole(actor.actorRoles);
    if (isAcademicManager(actor.actorRoles)) {
      return;
    }
    if (actor.actorRoles.includes("KAPRODI")) {
      const current = now();
      const [head] = await database
        .select({ id: programHeads.id })
        .from(programHeads)
        .where(
          and(
            eq(programHeads.userId, actor.actorUserId),
            eq(programHeads.prodiId, section.studyProgramId),
            lte(programHeads.startsAt, current),
            or(isNull(programHeads.endsAt), gt(programHeads.endsAt, current))
          )
        )
        .limit(1);
      if (head) {
        return;
      }
    }
    if (actor.actorRoles.includes("DOSEN")) {
      const [lecturer] = await database
        .select({ id: lecturers.id })
        .from(identityAccounts)
        .innerJoin(lecturers, eq(lecturers.dsn, identityAccounts.identifier))
        .where(eq(identityAccounts.userId, actor.actorUserId))
        .limit(1);
      if (lecturer) {
        const [assignment] = await database
          .select({ id: teachingAssignments.id })
          .from(teachingAssignments)
          .where(
            and(
              eq(teachingAssignments.classSectionId, section.id),
              eq(teachingAssignments.lecturerId, lecturer.id)
            )
          )
          .limit(1);
        if (assignment) {
          return;
        }
      }
    }
    throw new AttendanceDomainError(
      "ATTENDANCE_SCOPE_DENIED",
      "Data presensi berada di luar lingkup akses Anda."
    );
  };

  const list: AttendanceService["list"] = async ({
    actorRoles,
    actorUserId,
    classSectionId,
  }) => {
    const rows = await database
      .select({
        courseName: courses.name,
        meeting: classMeetings,
        section: classSections,
      })
      .from(classMeetings)
      .innerJoin(
        classSections,
        eq(classSections.id, classMeetings.classSectionId)
      )
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .where(
        and(
          eq(classSections.status, "PUBLISHED"),
          ...(classSectionId ? [eq(classSections.id, classSectionId)] : [])
        )
      )
      .orderBy(asc(classMeetings.startAt));
    const participantType = participantTypeForRoles(actorRoles);
    const currentPolicy = await getAttendancePolicy();
    const result: AttendanceMeetingRecord[] = [];
    for (const row of rows) {
      let participant: Participant;
      try {
        participant = await getParticipant(
          { actorRoles, actorUserId },
          {
            courseName: row.courseName,
            meeting: row.meeting,
            revision: null,
            section: row.section,
          }
        );
      } catch {
        continue;
      }
      const [storedSession] = await database
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.meetingId, row.meeting.id))
        .limit(1);
      const window = storedSession
        ? { closeAt: storedSession.closeAt, openAt: storedSession.openAt }
        : calculateAttendanceWindow(
            row.meeting.startAt,
            row.meeting.endAt,
            currentPolicy
          );
      const [record] = storedSession
        ? await database
            .select({
              id: attendanceRecords.id,
              status: attendanceRecords.status,
            })
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.sessionId, storedSession.id),
                eq(attendanceRecords.participantId, participant.id),
                eq(attendanceRecords.participantType, participantType)
              )
            )
            .limit(1)
        : [];
      result.push({
        classCode: row.section.code,
        classSectionId: row.section.id,
        closeAt: toIso(window.closeAt),
        courseName: row.courseName,
        endAt: toIso(row.meeting.endAt),
        id: row.meeting.id,
        modality: row.meeting.modality as "OFFLINE" | "ONLINE",
        openAt: toIso(window.openAt),
        record: record
          ? { id: record.id, status: record.status as AttendanceStatus }
          : null,
        sequence: row.meeting.sequence,
        startAt: toIso(row.meeting.startAt),
      });
    }
    return result;
  };

  const startCapture: AttendanceService["startCapture"] = async ({
    actorRoles,
    actorUserId,
    meetingId,
  }) => {
    const meeting = await getMeetingContext(meetingId);
    const participant = await getParticipant(
      { actorRoles, actorUserId },
      meeting
    );
    const session = await ensureSession(meeting);
    assertAttendanceWindowOpen(now(), {
      closeAt: session.closeAt,
      openAt: session.openAt,
    });
    const [existing] = await database
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, session.id),
          eq(attendanceRecords.participantId, participant.id),
          eq(attendanceRecords.participantType, participant.type)
        )
      )
      .limit(1);
    if (existing) {
      throw new AttendanceDomainError(
        "ATTENDANCE_ALREADY_SUBMITTED",
        "Presensi untuk pertemuan ini sudah tercatat."
      );
    }
    const captureAttemptId = crypto.randomUUID();
    const expiresAt = new Date(now().getTime() + CAPTURE_ATTEMPT_TTL_MS);
    await database.insert(attendanceCaptureAttempts).values({
      createdAt: now(),
      expiresAt,
      id: captureAttemptId,
      modality: meeting.meeting.modality,
      nonceHash: await sha256Text(captureAttemptId),
      participantId: participant.id,
      participantType: participant.type,
      sessionId: session.id,
    });
    return {
      captureAttemptId,
      expiresAt: toIso(expiresAt),
      meetingId,
      modality: meeting.meeting.modality as "OFFLINE" | "ONLINE",
      participantType: participant.type,
    };
  };

  const findIdempotencyRecord = async (scope: string, key: string) => {
    const [record] = await database
      .select()
      .from(idempotencyKeys)
      .where(
        and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key))
      )
      .limit(1);
    return record ?? null;
  };

  // eslint-disable-next-line complexity -- submit coordinates actor, window, evidence, location, and atomic persistence rules.
  const submit: AttendanceService["submit"] = async (input) => {
    const bytes = decodeBase64(input.contentBase64);
    const image = validateEvidenceImage({
      bytes,
      declaredMime: input.declaredMime,
    });
    const checksum = await sha256(bytes);
    const scope = `attendance.submit:${input.actorUserId}`;
    const requestHash = await sha256Text(
      JSON.stringify({
        accuracyMeters: input.accuracyMeters,
        captureAttemptId: input.captureAttemptId,
        checksum,
        declaredMime: input.declaredMime,
        filename: input.filename,
        latitude: input.latitude,
        longitude: input.longitude,
        note: input.note,
        status: input.status,
      })
    );
    const current = await findIdempotencyRecord(scope, input.idempotencyKey);
    let idempotencyId: string;
    if (current) {
      if (current.requestHash !== requestHash) {
        throw new AttendanceDomainError(
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "Kunci pengulangan sudah dipakai untuk payload berbeda."
        );
      }
      if (current.status === "COMPLETED" && current.resultReference) {
        const [record] = await database
          .select()
          .from(attendanceRecords)
          .where(eq(attendanceRecords.id, current.resultReference))
          .limit(1);
        if (record) {
          const [request] = await database
            .select({ requestedStatus: attendanceRequests.requestedStatus })
            .from(attendanceRequests)
            .where(eq(attendanceRequests.attendanceRecordId, record.id))
            .limit(1);
          return {
            id: record.id,
            requestedStatus:
              (request?.requestedStatus as AttendanceStatus | undefined) ??
              null,
            status: record.status as AttendanceStatus,
            submittedAt: toIso(record.submittedAt),
          };
        }
      }
      if (current.status === "FAILED") {
        idempotencyId = current.id;
        await database
          .update(idempotencyKeys)
          .set({
            expiresAt: new Date(now().getTime() + IDEMPOTENCY_TTL_MS),
            resultReference: null,
            status: "PENDING",
          })
          .where(eq(idempotencyKeys.id, current.id));
      } else {
        throw new AttendanceDomainError(
          "IDEMPOTENCY_IN_PROGRESS",
          "Permintaan presensi sedang diproses. Coba beberapa saat lagi."
        );
      }
    } else {
      idempotencyId = crypto.randomUUID();
      try {
        await database.insert(idempotencyKeys).values({
          actorUserId: input.actorUserId,
          createdAt: now(),
          expiresAt: new Date(now().getTime() + IDEMPOTENCY_TTL_MS),
          id: idempotencyId,
          key: input.idempotencyKey,
          requestHash,
          scope,
          status: "PENDING",
        });
      } catch {
        const raced = await findIdempotencyRecord(scope, input.idempotencyKey);
        if (raced?.requestHash === requestHash) {
          throw new AttendanceDomainError(
            "IDEMPOTENCY_IN_PROGRESS",
            "Permintaan presensi sedang diproses. Coba beberapa saat lagi."
          );
        }
        throw new AttendanceDomainError(
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "Kunci pengulangan sudah dipakai untuk payload berbeda."
        );
      }
    }

    let objectKey: string | null = null;
    try {
      const [attempt] = await database
        .select({
          attempt: attendanceCaptureAttempts,
          session: attendanceSessions,
        })
        .from(attendanceCaptureAttempts)
        .innerJoin(
          attendanceSessions,
          eq(attendanceSessions.id, attendanceCaptureAttempts.sessionId)
        )
        .where(eq(attendanceCaptureAttempts.id, input.captureAttemptId))
        .limit(1);
      if (!attempt) {
        throw new AttendanceDomainError(
          "ATTENDANCE_CAPTURE_ATTEMPT_INVALID",
          "Percobaan pengambilan foto tidak valid."
        );
      }
      const [meetingIdRow] = await database
        .select({ meetingId: attendanceSessions.meetingId })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, attempt.session.id))
        .limit(1);
      const meeting = await getMeetingContext(meetingIdRow?.meetingId ?? "");
      const participant = await getParticipant(
        { actorRoles: input.actorRoles, actorUserId: input.actorUserId },
        meeting
      );
      if (
        attempt.attempt.participantId !== participant.id ||
        attempt.attempt.participantType !== participant.type
      ) {
        throw new AttendanceDomainError(
          "ATTENDANCE_CAPTURE_ATTEMPT_INVALID",
          "Percobaan pengambilan foto tidak valid."
        );
      }
      const currentTime = now();
      if (attempt.attempt.usedAt || currentTime > attempt.attempt.expiresAt) {
        throw new AttendanceDomainError(
          "ATTENDANCE_CAPTURE_ATTEMPT_EXPIRED",
          "Sesi pengambilan foto sudah kedaluwarsa. Mulai presensi lagi."
        );
      }
      assertAttendanceWindowOpen(currentTime, {
        closeAt: attempt.session.closeAt,
        openAt: attempt.session.openAt,
      });
      if (input.status === "ALPA") {
        throw new AttendanceDomainError(
          "INVALID_ATTENDANCE_STATUS",
          "Status alpa dibuat oleh proses sistem setelah window berakhir."
        );
      }
      const note = input.note?.trim() || null;
      if ((input.status === "IZIN" || input.status === "SAKIT") && !note) {
        throw new AttendanceDomainError(
          "ATTENDANCE_NOTE_REQUIRED",
          "Catatan wajib diisi untuk pengajuan izin atau sakit."
        );
      }
      let latitude: number | null = null;
      let longitude: number | null = null;
      let distanceMeters: number | null = null;
      let referenceLatitude: number | null = null;
      let referenceLongitude: number | null = null;
      if (attempt.session.modality === "OFFLINE") {
        if (input.latitude === undefined || input.longitude === undefined) {
          throw new AttendanceDomainError(
            "ATTENDANCE_LOCATION_REQUIRED",
            "Lokasi wajib diaktifkan untuk presensi luring."
          );
        }
        latitude = assertCoordinate(input.latitude, "latitude");
        longitude = assertCoordinate(input.longitude, "longitude");
        const [room] = meeting.meeting.roomId
          ? await database
              .select({ latitude: rooms.latitude, longitude: rooms.longitude })
              .from(rooms)
              .where(eq(rooms.id, meeting.meeting.roomId))
              .limit(1)
          : [];
        if (!room) {
          throw new AttendanceDomainError(
            "ATTENDANCE_ROOM_NOT_CONFIGURED",
            "Ruang pertemuan belum memiliki koordinat presensi."
          );
        }
        referenceLatitude = room.latitude;
        referenceLongitude = room.longitude;
        distanceMeters = calculateDistanceMeters(
          { latitude, longitude },
          { latitude: room.latitude, longitude: room.longitude }
        );
        if (distanceMeters > attempt.session.policyRadiusMeters) {
          throw new AttendanceDomainError(
            "ATTENDANCE_OUTSIDE_RADIUS",
            "Lokasi Anda berada di luar radius presensi."
          );
        }
      }
      const [existing] = await database
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, attempt.session.id),
            eq(attendanceRecords.participantId, participant.id),
            eq(attendanceRecords.participantType, participant.type)
          )
        )
        .limit(1);
      if (existing) {
        throw new AttendanceDomainError(
          "ATTENDANCE_ALREADY_SUBMITTED",
          "Presensi untuk pertemuan ini sudah tercatat."
        );
      }
      const recordId = crypto.randomUUID();
      const evidenceId = crypto.randomUUID();
      const fileObjectId = crypto.randomUUID();
      objectKey = `attendance/${attempt.session.id}/${participant.type.toLowerCase()}/${recordId}/${crypto.randomUUID()}`;
      await storage.put(objectKey, bytes, {
        httpMetadata: { contentType: image.mimeType },
      });
      const createdAt = now();
      const requestId =
        input.status === "IZIN" || input.status === "SAKIT"
          ? crypto.randomUUID()
          : null;
      await database.batch([
        database.insert(fileObjects).values({
          checksum,
          createdAt,
          createdBy: input.actorUserId,
          declaredMime: input.declaredMime,
          id: fileObjectId,
          mimeType: image.mimeType,
          objectKey,
          originalFilename: input.filename?.trim() || DEFAULT_EVIDENCE_FILENAME,
          ownerId: recordId,
          ownerType: "ATTENDANCE_EVIDENCE",
          sizeBytes: bytes.length,
          status: "ACTIVE",
        }),
        database.insert(attendanceRecords).values({
          createdAt,
          id: recordId,
          note,
          participantId: participant.id,
          participantType: participant.type,
          sessionId: attempt.session.id,
          status: input.status,
          submittedAt: createdAt,
          updatedAt: createdAt,
          version: 1,
        }),
        database.insert(attendanceEvidences).values({
          accuracyMeters: input.accuracyMeters,
          attendanceRecordId: recordId,
          captureAttemptId: input.captureAttemptId,
          capturedAt: createdAt,
          checksum,
          createdAt,
          dimensionHeight: image.height,
          dimensionWidth: image.width,
          distanceMeters,
          evidenceType: "PHOTO",
          fileObjectId,
          id: evidenceId,
          latitude,
          longitude,
          mimeType: image.mimeType,
          policyRadiusMeters: attempt.session.policyRadiusMeters,
          referenceLatitude,
          referenceLongitude,
          sizeBytes: bytes.length,
        }),
        ...(requestId
          ? [
              database.insert(attendanceRequests).values({
                attendanceRecordId: recordId,
                createdAt,
                id: requestId,
                requestedStatus: input.status,
                status: "PENDING",
              }),
            ]
          : []),
        database
          .update(attendanceCaptureAttempts)
          .set({ usedAt: createdAt })
          .where(eq(attendanceCaptureAttempts.id, input.captureAttemptId)),
        database
          .update(idempotencyKeys)
          .set({ resultReference: recordId, status: "COMPLETED" })
          .where(eq(idempotencyKeys.id, idempotencyId)),
        database.insert(auditLogs).values({
          action: "CREATE",
          actorUserId: input.actorUserId,
          afterState: JSON.stringify({
            participantType: participant.type,
            status: input.status,
          }),
          entityId: recordId,
          entityType: "ATTENDANCE_RECORD",
          id: crypto.randomUUID(),
          metadata: JSON.stringify({ sessionId: attempt.session.id }),
        }),
      ]);
      return {
        id: recordId,
        requestedStatus: requestId ? input.status : null,
        status: input.status,
        submittedAt: toIso(createdAt),
      };
    } catch (error) {
      let failure: unknown = error;
      if (objectKey) {
        try {
          await storage.delete(objectKey);
        } catch (cleanupError) {
          failure = new Error(
            "Bukti presensi gagal disimpan dan pembersihan objek juga gagal.",
            { cause: cleanupError }
          );
        }
      }
      await database
        .update(idempotencyKeys)
        .set({ status: "FAILED" })
        .where(eq(idempotencyKeys.id, idempotencyId));
      throw failure;
    }
  };

  const listReviews: AttendanceService["listReviews"] = async ({
    actorRoles,
    actorUserId,
    status,
  }) => {
    assertAttendanceReviewRole(actorRoles);
    const rows = await database
      .select({
        courseName: courses.name,
        meeting: classMeetings,
        record: attendanceRecords,
        request: attendanceRequests,
        section: classSections,
      })
      .from(attendanceRequests)
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.id, attendanceRequests.attendanceRecordId)
      )
      .innerJoin(
        attendanceSessions,
        eq(attendanceSessions.id, attendanceRecords.sessionId)
      )
      .innerJoin(
        classMeetings,
        eq(classMeetings.id, attendanceSessions.meetingId)
      )
      .innerJoin(
        classSections,
        eq(classSections.id, attendanceSessions.classSectionId)
      )
      .innerJoin(courses, eq(courses.id, classSections.courseId))
      .where(status ? eq(attendanceRequests.status, status) : undefined)
      .orderBy(desc(attendanceRequests.createdAt));
    const result = [];
    for (const row of rows) {
      try {
        await ensureReviewScope({ actorRoles, actorUserId }, row.section);
      } catch {
        continue;
      }
      const [student] =
        row.record.participantType === "STUDENT"
          ? await database
              .select({ name: students.name })
              .from(students)
              .where(eq(students.id, row.record.participantId))
              .limit(1)
          : [];
      const [lecturer] =
        row.record.participantType === "LECTURER"
          ? await database
              .select({ name: lecturers.name })
              .from(lecturers)
              .where(eq(lecturers.id, row.record.participantId))
              .limit(1)
          : [];
      result.push({
        classCode: row.section.code,
        courseName: row.courseName,
        createdAt: toIso(row.request.createdAt),
        id: row.request.id,
        participantId: row.record.participantId,
        participantName: student?.name ?? lecturer?.name ?? "Peserta",
        requestedStatus: row.request.requestedStatus as "IZIN" | "SAKIT",
        status: row.request.status as "PENDING" | "APPROVED" | "REJECTED",
      });
    }
    return result;
  };

  const decideRequest: AttendanceService["decideRequest"] = async ({
    actorRoles,
    actorUserId,
    approve,
    reason,
    requestId,
    expectedVersion,
  }) => {
    const [row] = await database
      .select({
        record: attendanceRecords,
        request: attendanceRequests,
        section: classSections,
        session: attendanceSessions,
      })
      .from(attendanceRequests)
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.id, attendanceRequests.attendanceRecordId)
      )
      .innerJoin(
        attendanceSessions,
        eq(attendanceSessions.id, attendanceRecords.sessionId)
      )
      .innerJoin(
        classSections,
        eq(classSections.id, attendanceSessions.classSectionId)
      )
      .where(eq(attendanceRequests.id, requestId))
      .limit(1);
    if (!row) {
      throw new AttendanceDomainError(
        "ATTENDANCE_REQUEST_NOT_FOUND",
        "Pengajuan presensi tidak ditemukan."
      );
    }
    await ensureReviewScope({ actorRoles, actorUserId }, row.section);
    if (
      row.request.status !== "PENDING" ||
      row.record.version !== expectedVersion
    ) {
      throw new AttendanceDomainError(
        "STALE_ATTENDANCE_REQUEST",
        "Pengajuan presensi telah berubah. Muat ulang lalu coba lagi."
      );
    }
    if (!approve && !reason?.trim()) {
      throw new AttendanceDomainError(
        "ATTENDANCE_REJECTION_REASON_REQUIRED",
        "Alasan penolakan wajib diisi."
      );
    }
    const decision = approve ? "APPROVED" : "REJECTED";
    const nextStatus = approve ? row.request.requestedStatus : "ALPA";
    const decidedAt = now();
    const updated = await database.batch([
      database
        .update(attendanceRequests)
        .set({
          decidedAt,
          decidedBy: actorUserId,
          decisionReason: reason?.trim() || null,
          status: decision,
        })
        .where(
          and(
            eq(attendanceRequests.id, requestId),
            eq(attendanceRequests.status, "PENDING")
          )
        ),
      database
        .update(attendanceRecords)
        .set({
          status: nextStatus,
          updatedAt: decidedAt,
          version: expectedVersion + 1,
        })
        .where(
          and(
            eq(attendanceRecords.id, row.record.id),
            eq(attendanceRecords.version, expectedVersion)
          )
        ),
      database.insert(attendanceReviewLogs).values({
        actorUserId,
        attendanceRequestId: requestId,
        createdAt: decidedAt,
        decision,
        id: crypto.randomUUID(),
        reason: reason?.trim() || null,
      }),
      database.insert(attendanceAdjustments).values({
        actorUserId,
        attendanceRecordId: row.record.id,
        createdAt: decidedAt,
        fromStatus: row.record.status,
        id: crypto.randomUUID(),
        reason: reason?.trim() || "Pengajuan presensi disetujui.",
        toStatus: nextStatus,
        version: expectedVersion + 1,
      }),
      database.insert(auditLogs).values({
        action: "UPDATE",
        actorUserId,
        afterState: JSON.stringify({ decision, status: nextStatus }),
        beforeState: JSON.stringify({ status: row.record.status }),
        entityId: row.record.id,
        entityType: "ATTENDANCE_RECORD",
        id: crypto.randomUUID(),
      }),
    ]);
    if (!updated) {
      throw new AttendanceDomainError(
        "STALE_ATTENDANCE_REQUEST",
        "Pengajuan presensi telah berubah. Muat ulang lalu coba lagi."
      );
    }
    return { status: decision };
  };

  const downloadEvidence: AttendanceService["downloadEvidence"] = async ({
    actorRoles,
    actorUserId,
    evidenceId,
  }) => {
    const [row] = await database
      .select({
        evidence: attendanceEvidences,
        file: fileObjects,
        record: attendanceRecords,
        section: classSections,
      })
      .from(attendanceEvidences)
      .innerJoin(
        fileObjects,
        eq(fileObjects.id, attendanceEvidences.fileObjectId)
      )
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.id, attendanceEvidences.attendanceRecordId)
      )
      .innerJoin(
        attendanceSessions,
        eq(attendanceSessions.id, attendanceRecords.sessionId)
      )
      .innerJoin(
        classSections,
        eq(classSections.id, attendanceSessions.classSectionId)
      )
      .where(eq(attendanceEvidences.id, evidenceId))
      .limit(1);
    if (!row) {
      throw new AttendanceDomainError(
        "ATTENDANCE_EVIDENCE_NOT_FOUND",
        "Bukti presensi tidak ditemukan."
      );
    }
    const canOwn =
      actorRoles.includes("MAHASISWA") || actorRoles.includes("DOSEN");
    if (canOwn && row.record.participantId) {
      const [session] = await database
        .select({ meetingId: attendanceSessions.meetingId })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, row.record.sessionId))
        .limit(1);
      const meeting = await getMeetingContext(session?.meetingId ?? "");
      const participant = await getParticipant(
        { actorRoles, actorUserId },
        meeting
      );
      if (participant.id !== row.record.participantId) {
        await ensureReviewScope({ actorRoles, actorUserId }, row.section);
      }
    } else {
      await ensureReviewScope({ actorRoles, actorUserId }, row.section);
    }
    const object = await storage.get(row.file.objectKey);
    if (!object?.body) {
      throw new AttendanceDomainError(
        "ATTENDANCE_EVIDENCE_NOT_FOUND",
        "Bukti presensi tidak ditemukan."
      );
    }
    return { body: object.body, contentType: row.evidence.mimeType };
  };

  const generateAlpa: AttendanceService["generateAlpa"] = async ({
    actorRoles,
    actorUserId,
    idempotencyKey,
    sessionId,
  }) => {
    const [sessionRow] = await database
      .select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id, sessionId))
      .limit(1);
    if (!sessionRow) {
      throw new AttendanceDomainError(
        "ATTENDANCE_SESSION_NOT_FOUND",
        "Sesi presensi tidak ditemukan."
      );
    }
    const meeting = await getMeetingContext(sessionRow.meetingId);
    await ensureReviewScope({ actorRoles, actorUserId }, meeting.section);
    if (now() <= sessionRow.closeAt) {
      throw new AttendanceDomainError(
        "ATTENDANCE_WINDOW_OPEN",
        "Status alpa baru dapat dibuat setelah window presensi ditutup."
      );
    }
    const [existingJob] = await database
      .select()
      .from(attendanceGenerationJobs)
      .where(
        and(
          eq(attendanceGenerationJobs.sessionId, sessionId),
          eq(attendanceGenerationJobs.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);
    if (existingJob?.status === "COMPLETED") {
      return {
        createdCount: existingJob.completedCount,
        jobId: existingJob.id,
        status: existingJob.status,
      };
    }
    const jobId = existingJob?.id ?? crypto.randomUUID();
    const jobStatement = existingJob
      ? database
          .update(attendanceGenerationJobs)
          .set({ status: "RUNNING", updatedAt: now() })
          .where(eq(attendanceGenerationJobs.id, jobId))
      : database.insert(attendanceGenerationJobs).values({
          createdAt: now(),
          id: jobId,
          idempotencyKey,
          sessionId,
          status: "RUNNING",
          totalCount: 0,
          updatedAt: now(),
        });
    await jobStatement;
    const studentParticipants = await database
      .select({ participantId: classEnrollments.studentId })
      .from(classEnrollments)
      .where(eq(classEnrollments.classSectionId, meeting.section.id))
      .orderBy(asc(classEnrollments.studentId));
    const lecturerParticipants = await database
      .select({ participantId: teachingAssignments.lecturerId })
      .from(teachingAssignments)
      .where(eq(teachingAssignments.classSectionId, meeting.section.id))
      .orderBy(asc(teachingAssignments.lecturerId));
    const participants = [
      ...studentParticipants.map((row) => ({
        participantId: row.participantId,
        participantType: "STUDENT" as const,
      })),
      ...lecturerParticipants.map((row) => ({
        participantId: row.participantId,
        participantType: "LECTURER" as const,
      })),
    ];
    const existing = await database
      .select({
        participantId: attendanceRecords.participantId,
        participantType: attendanceRecords.participantType,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, sessionId));
    const existingIds = new Set(
      existing.map((row) => `${row.participantType}:${row.participantId}`)
    );
    const missing = participants.filter(
      (row) => !existingIds.has(`${row.participantType}:${row.participantId}`)
    );
    let createdCount = existing.length;
    for (let index = 0; index < missing.length; index += 20) {
      const chunk = missing.slice(index, index + 20);
      const statements = chunk.map((row) =>
        database.insert(attendanceRecords).values({
          createdAt: now(),
          id: crypto.randomUUID(),
          note: "Dibuat otomatis setelah window presensi ditutup.",
          participantId: row.participantId,
          participantType: row.participantType,
          sessionId,
          status: "ALPA",
          submittedAt: now(),
          updatedAt: now(),
          version: 1,
        })
      );
      if (statements.length > 0) {
        const firstStatement = statements.at(0);
        if (firstStatement) {
          await database.batch([firstStatement, ...statements.slice(1)]);
        }
      }
      createdCount += chunk.length;
      await database
        .update(attendanceGenerationJobs)
        .set({
          completedCount: createdCount,
          cursor: chunk.at(-1)?.participantId ?? null,
          processedCount: createdCount,
          totalCount: participants.length,
          updatedAt: now(),
        })
        .where(eq(attendanceGenerationJobs.id, jobId));
    }
    await database
      .update(attendanceGenerationJobs)
      .set({
        completedCount: createdCount,
        processedCount: participants.length,
        status: "COMPLETED",
        totalCount: participants.length,
        updatedAt: now(),
      })
      .where(eq(attendanceGenerationJobs.id, jobId));
    return { createdCount, jobId, status: "COMPLETED" };
  };

  return {
    decideRequest,
    downloadEvidence,
    generateAlpa,
    list,
    listReviews,
    startCapture,
    submit,
  };
};

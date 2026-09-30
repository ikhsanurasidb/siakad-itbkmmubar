import type { IdentityService } from "@siakad-itbkmmubar/api/context";
import {
  DEFAULT_EMAIL_CHANGE_TTL_MS,
  DEFAULT_TEMPORARY_PASSWORD_TTL_MS,
  IDENTIFIER_SEQUENCE_MAX,
  IdentityDomainError,
  assertKnownRole,
  assertRoleConflictFree,
  assertResetPasswordPermission,
  formatInstitutionalIdentifier,
  getDateInTimeZone,
  normalizeIdentifier,
  normalizePhoneNumber,
  previewIdentifierAllocations,
} from "@siakad-itbkmmubar/api/identity";
import type { IdentityType, RoleKey } from "@siakad-itbkmmubar/api/identity";
import type { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";
import { session, user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  identityAccounts,
  emailChangeRequests,
  identifierReservations,
  identifierSequences,
  programHeads,
  roles,
  securityEvents,
  userRoles,
  userScopes,
} from "@siakad-itbkmmubar/db/schema/identity";
import { studyPrograms } from "@siakad-itbkmmubar/db/schema/master-data";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import { and, desc, eq, sql } from "drizzle-orm";

type ConfiguredAuth = ReturnType<typeof createConfiguredAuth>;

const generatedPrefixes: Record<Exclude<IdentityType, "MAHASISWA">, string> = {
  ADMIN_AKADEMIK: "AKD",
  ADMIN_KEUANGAN: "KEU",
  DOSEN: "DSN",
  SUPERADMIN: "SUP",
};

const defaultRoleByIdentityType: Record<IdentityType, RoleKey> = {
  ADMIN_AKADEMIK: "ADMIN_AKADEMIK",
  ADMIN_KEUANGAN: "ADMIN_KEUANGAN",
  DOSEN: "DOSEN",
  MAHASISWA: "MAHASISWA",
  SUPERADMIN: "SUPERADMIN",
};

const createTemporaryPassword = (): string => {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const values = new Uint32Array(24);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    ""
  );
};

const createInternalEmail = (identifier: string): string =>
  `${identifier.toLowerCase()}@account.siakad.local`;

const findReservation = async (database: Database, masterRecordId: string) => {
  const [reservation] = await database
    .select()
    .from(identifierReservations)
    .where(eq(identifierReservations.masterRecordId, masterRecordId))
    .limit(1);
  return reservation ?? null;
};

const reserveGeneratedIdentifier = async ({
  database,
  idempotencyKey,
  masterRecordId,
  now,
  prefix,
  timeZone,
}: {
  database: Database;
  idempotencyKey: string;
  masterRecordId: string;
  now: Date;
  prefix: string;
  timeZone: string;
}): Promise<{ identifier: string; reservationId: string }> => {
  const existingReservation = await findReservation(database, masterRecordId);
  if (existingReservation) {
    if (existingReservation.status === "PROVISIONED") {
      throw new IdentityDomainError(
        "ALREADY_PROVISIONED",
        "Master record tersebut sudah memiliki akun terprovision."
      );
    }
    return {
      identifier: existingReservation.identifier,
      reservationId: existingReservation.id,
    };
  }

  const sequenceDate = getDateInTimeZone(now, timeZone);
  const [sequence] = await database
    .insert(identifierSequences)
    .values({
      nextValue: 2,
      prefix,
      sequenceDate,
      version: 1,
    })
    .onConflictDoUpdate({
      set: {
        nextValue: sql`${identifierSequences.nextValue} + 1`,
        version: sql`${identifierSequences.version} + 1`,
      },
      target: [identifierSequences.prefix, identifierSequences.sequenceDate],
      where: sql`${identifierSequences.nextValue} <= ${IDENTIFIER_SEQUENCE_MAX}`,
    })
    .returning({ nextValue: identifierSequences.nextValue });

  if (!sequence) {
    throw new IdentityDomainError(
      "IDENTIFIER_SEQUENCE_OVERFLOW",
      "Sequence identifier untuk tanggal tersebut sudah mencapai 999."
    );
  }

  const sequenceNumber = sequence.nextValue - 1;
  const identifier = formatInstitutionalIdentifier(
    prefix,
    sequenceDate,
    sequenceNumber
  );
  const reservationId = createUuidV7();

  await database.insert(identifierReservations).values({
    createdAt: now,
    id: reservationId,
    idempotencyKey,
    identifier,
    masterRecordId,
    prefix,
    sequenceDate,
    sequenceNumber,
    status: "RESERVED",
  });

  return { identifier, reservationId };
};

const deleteCreatedUser = async (database: Database, userId: string) => {
  await database.delete(user).where(eq(user.id, userId));
};

const recordSecurityEvent = async ({
  database,
  eventType,
  metadata,
  now,
  userId,
}: {
  database: Database;
  eventType: string;
  metadata: Record<string, string>;
  now: Date;
  userId: string;
}) => {
  await database.insert(securityEvents).values({
    createdAt: now,
    eventType,
    id: createUuidV7(),
    metadata: JSON.stringify(metadata),
    userId,
  });
};

const hashVerificationToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
};

const assertCurrentPassword = async (
  auth: ConfiguredAuth,
  userId: string,
  currentPassword: string
): Promise<void> => {
  const credential = await auth.$context.then((context) =>
    context.internalAdapter.findCredentialAccount(userId)
  );
  const authContext = await auth.$context;
  const valid = credential?.password
    ? await authContext.password.verify({
        hash: credential.password,
        password: currentPassword,
      })
    : false;
  if (!valid) {
    throw new IdentityDomainError(
      "INVALID_CURRENT_PASSWORD",
      "Kata sandi saat ini tidak sesuai."
    );
  }
};

export const createIdentityService = ({
  auth,
  database,
  now = () => new Date(),
  timeZone,
}: {
  auth: ConfiguredAuth;
  database: Database;
  now?: () => Date;
  timeZone: string;
}): IdentityService => {
  const createAccount: IdentityService["createAccount"] = async (input) => {
    const expectedRole = defaultRoleByIdentityType[input.identityType];
    if (input.roleKey) {
      assertKnownRole(input.roleKey);
      if (input.roleKey !== expectedRole) {
        throw new IdentityDomainError(
          "IDENTITY_ROLE_MISMATCH",
          "Role awal harus sesuai dengan tipe identitas akun."
        );
      }
    }
    const currentTime = now();
    const prefix =
      input.identityType === "MAHASISWA"
        ? null
        : generatedPrefixes[input.identityType];
    let identifier: string;
    let reservationId: string | null = null;

    if (prefix) {
      const masterRecordId = input.masterRecordId ?? createUuidV7();
      const reservation = await reserveGeneratedIdentifier({
        database,
        idempotencyKey: `provision:${masterRecordId}`,
        masterRecordId,
        now: currentTime,
        prefix,
        timeZone,
      });
      ({ identifier, reservationId } = reservation);
    } else {
      if (!input.identifier) {
        throw new IdentityDomainError(
          "IDENTIFIER_REQUIRED",
          "NIM wajib diisi saat memprovision akun Mahasiswa."
        );
      }
      identifier = normalizeIdentifier(input.identifier);
    }

    const temporaryPassword = createTemporaryPassword();
    const authContext = await auth.$context;
    let createdUserId: string | null = null;

    try {
      const createdUser = await authContext.internalAdapter.createUser(
        {
          email:
            input.email?.trim().toLowerCase() ??
            createInternalEmail(identifier),
          emailVerified: true,
          name: input.name.trim(),
          username: identifier,
        },
        { method: "admin" }
      );
      const { id: userId } = createdUser;
      createdUserId = userId;
      const password = await authContext.password.hash(temporaryPassword);
      await authContext.internalAdapter.linkAccount({
        accountId: userId,
        password,
        providerId: "credential",
        userId,
      });

      const accountId = createUuidV7();
      await database.insert(identityAccounts).values({
        createdAt: currentTime,
        id: accountId,
        identifier,
        identityType: input.identityType,
        mustChangePassword: true,
        status: "ACTIVE",
        temporaryPasswordExpiresAt: new Date(
          currentTime.getTime() + DEFAULT_TEMPORARY_PASSWORD_TTL_MS
        ),
        updatedAt: currentTime,
        userId,
      });
      await database.insert(userRoles).values({
        assignedAt: currentTime,
        id: createUuidV7(),
        isActive: true,
        roleKey: input.roleKey ?? defaultRoleByIdentityType[input.identityType],
        userId,
      });
      await recordSecurityEvent({
        database,
        eventType: "IDENTITY_ACCOUNT_PROVISIONED",
        metadata: {
          actorUserId: input.actorUserId,
          identifier,
          identityType: input.identityType,
        },
        now: currentTime,
        userId,
      });

      if (reservationId) {
        await database
          .update(identifierReservations)
          .set({ status: "PROVISIONED" })
          .where(eq(identifierReservations.id, reservationId));
      }
    } catch (error) {
      if (createdUserId) {
        await deleteCreatedUser(database, createdUserId);
      }
      throw error;
    }

    return {
      identifier,
      temporaryPassword,
      userId: createdUserId as string,
    };
  };

  const thisAssignRole = async (input: {
    assignedBy: string;
    roleKey: RoleKey;
    userId: string;
  }): Promise<void> => {
    await createIdentityService({ auth, database, now, timeZone }).assignRole(
      input
    );
  };

  return {
    activateAccount: async ({ accountId, actorUserId }) => {
      const [identity] = await database
        .select({ userId: identityAccounts.userId })
        .from(identityAccounts)
        .where(eq(identityAccounts.id, accountId))
        .limit(1);
      if (!identity) {
        throw new IdentityDomainError(
          "ACCOUNT_NOT_FOUND",
          "Akun tidak ditemukan."
        );
      }
      await database
        .update(identityAccounts)
        .set({
          deactivatedAt: null,
          status: "ACTIVE",
          updatedAt: now(),
        })
        .where(eq(identityAccounts.id, accountId));
      await recordSecurityEvent({
        database,
        eventType: "IDENTITY_ACCOUNT_ACTIVATED",
        metadata: { actorUserId },
        now: now(),
        userId: identity.userId,
      });
    },
    assignProgramHead: async ({
      assignedBy,
      endsAt,
      prodiId,
      startsAt,
      userId,
    }) => {
      if (endsAt && endsAt <= startsAt) {
        throw new IdentityDomainError(
          "INVALID_PROGRAM_HEAD_DATES",
          "Tanggal akhir assignment harus setelah tanggal mulai."
        );
      }
      const [dosen] = await database
        .select({ id: userRoles.id })
        .from(userRoles)
        .innerJoin(
          identityAccounts,
          eq(identityAccounts.userId, userRoles.userId)
        )
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleKey, "DOSEN"),
            eq(userRoles.isActive, true),
            eq(identityAccounts.status, "ACTIVE")
          )
        )
        .limit(1);
      if (!dosen) {
        throw new IdentityDomainError(
          "PROGRAM_HEAD_REQUIRES_DOSEN",
          "Kaprodi hanya dapat ditetapkan pada akun Dosen aktif."
        );
      }
      const [prodi] = await database
        .select({ id: studyPrograms.id })
        .from(studyPrograms)
        .where(
          and(eq(studyPrograms.id, prodiId), eq(studyPrograms.status, "ACTIVE"))
        )
        .limit(1);
      if (!prodi) {
        throw new IdentityDomainError(
          "PROGRAM_NOT_FOUND",
          "Program studi aktif tidak ditemukan."
        );
      }
      const existingAssignments = await database
        .select()
        .from(programHeads)
        .where(eq(programHeads.prodiId, prodiId));
      const newStart = startsAt.getTime();
      const newEnd = endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const assignmentsToClose: typeof existingAssignments = [];
      for (const assignment of existingAssignments) {
        const existingEnd =
          assignment.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
        const overlaps =
          assignment.startsAt.getTime() < newEnd && newStart < existingEnd;
        if (!overlaps) {
          continue;
        }
        if (
          assignment.endsAt === null &&
          assignment.startsAt.getTime() < newStart
        ) {
          assignmentsToClose.push(assignment);
          continue;
        }
        throw new IdentityDomainError(
          "PROGRAM_HEAD_OVERLAP",
          "Periode assignment Kaprodi bertabrakan dengan assignment yang sudah ada."
        );
      }
      await Promise.all(
        assignmentsToClose.map((assignment) =>
          Promise.all([
            database
              .update(programHeads)
              .set({ endsAt: startsAt })
              .where(eq(programHeads.id, assignment.id)),
            database
              .update(userScopes)
              .set({ endsAt: startsAt })
              .where(
                and(
                  eq(userScopes.scopeId, assignment.prodiId),
                  eq(userScopes.scopeType, "PRODI"),
                  eq(userScopes.startsAt, assignment.startsAt),
                  eq(userScopes.userId, assignment.userId)
                )
              ),
          ])
        )
      );
      await thisAssignRole({ assignedBy, roleKey: "KAPRODI", userId });
      await database.insert(programHeads).values({
        assignedAt: now(),
        assignedBy,
        endsAt,
        id: createUuidV7(),
        prodiId,
        startsAt,
        userId,
      });
      await database.insert(userScopes).values({
        createdAt: now(),
        endsAt,
        id: createUuidV7(),
        scopeId: prodiId,
        scopeType: "PRODI",
        startsAt,
        userId,
      });
      await recordSecurityEvent({
        database,
        eventType: "PROGRAM_HEAD_ASSIGNED",
        metadata: { assignedBy, prodiId },
        now: now(),
        userId,
      });
    },
    assignRole: async ({ assignedBy, roleKey, userId }) => {
      const [role] = await database
        .select({ key: roles.key })
        .from(roles)
        .where(eq(roles.key, roleKey))
        .limit(1);
      if (!role) {
        throw new IdentityDomainError(
          "UNKNOWN_ROLE",
          "Role yang diminta tidak terdaftar pada katalog sistem."
        );
      }
      const activeRoleRows = await database
        .select({ roleKey: userRoles.roleKey })
        .from(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));
      const activeRoles = activeRoleRows.map((row) => row.roleKey);
      assertRoleConflictFree(activeRoles, roleKey);
      if (roleKey === "KAPRODI" && !activeRoles.includes("DOSEN")) {
        throw new IdentityDomainError(
          "PROGRAM_HEAD_REQUIRES_DOSEN",
          "Kaprodi hanya dapat ditetapkan pada akun Dosen."
        );
      }
      if (activeRoles.includes(roleKey)) {
        return;
      }
      await database.insert(userRoles).values({
        assignedAt: now(),
        assignedBy,
        id: createUuidV7(),
        isActive: true,
        roleKey,
        userId,
      });
      await recordSecurityEvent({
        database,
        eventType: "ROLE_ASSIGNED",
        metadata: { assignedBy, roleKey },
        now: now(),
        userId,
      });
    },
    assignScope: async ({ endsAt, scopeId, scopeType, startsAt, userId }) => {
      const requiredRole: Record<"KELAS" | "OWNERSHIP" | "PRODI", RoleKey> = {
        KELAS: "DOSEN",
        OWNERSHIP: "MAHASISWA",
        PRODI: "KAPRODI",
      };
      const [role] = await database
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleKey, requiredRole[scopeType]),
            eq(userRoles.isActive, true)
          )
        )
        .limit(1);
      if (!role) {
        throw new IdentityDomainError(
          "SCOPE_ROLE_MISMATCH",
          "Scope tidak sesuai dengan role aktif pengguna."
        );
      }
      await database.insert(userScopes).values({
        createdAt: now(),
        endsAt,
        id: createUuidV7(),
        scopeId,
        scopeType,
        startsAt,
        userId,
      });
    },
    completeFirstLogin: async (userId) => {
      const currentTime = now();
      await database
        .update(identityAccounts)
        .set({
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          updatedAt: currentTime,
        })
        .where(
          and(
            eq(identityAccounts.userId, userId),
            eq(identityAccounts.mustChangePassword, true)
          )
        );
      await recordSecurityEvent({
        database,
        eventType: "FIRST_LOGIN_PASSWORD_CHANGED",
        metadata: {},
        now: currentTime,
        userId,
      });
    },
    confirmEmailChange: async ({ verificationToken }) => {
      const tokenHash = await hashVerificationToken(verificationToken.trim());
      const [request] = await database
        .select()
        .from(emailChangeRequests)
        .where(
          and(
            eq(emailChangeRequests.verificationTokenHash, tokenHash),
            eq(emailChangeRequests.status, "PENDING")
          )
        )
        .limit(1);
      if (!request) {
        throw new IdentityDomainError(
          "INVALID_EMAIL_VERIFICATION",
          "Token verifikasi email tidak valid."
        );
      }
      const currentTime = now();
      if (request.expiresAt <= currentTime) {
        await database
          .update(emailChangeRequests)
          .set({ status: "EXPIRED" })
          .where(eq(emailChangeRequests.id, request.id));
        throw new IdentityDomainError(
          "EXPIRED_EMAIL_VERIFICATION",
          "Token verifikasi email sudah kedaluwarsa."
        );
      }
      const existingUser = await auth.$context.then((context) =>
        context.internalAdapter.findUserByEmail(request.newEmail, {
          includeAccounts: false,
        })
      );
      if (existingUser && existingUser.user.id !== request.userId) {
        throw new IdentityDomainError(
          "EMAIL_ALREADY_USED",
          "Email tersebut sudah digunakan oleh akun lain."
        );
      }
      const authContext = await auth.$context;
      await authContext.internalAdapter.updateUser(request.userId, {
        email: request.newEmail,
        emailVerified: true,
      });
      await database
        .update(emailChangeRequests)
        .set({ status: "VERIFIED", verifiedAt: currentTime })
        .where(eq(emailChangeRequests.id, request.id));
      await database.delete(session).where(eq(session.userId, request.userId));
      await recordSecurityEvent({
        database,
        eventType: "EMAIL_CHANGED",
        metadata: { userId: request.userId },
        now: currentTime,
        userId: request.userId,
      });
      return { email: request.newEmail };
    },
    createAccount,
    deactivateAccount: async ({ accountId, actorUserId }) => {
      const [identity] = await database
        .select({ userId: identityAccounts.userId })
        .from(identityAccounts)
        .where(eq(identityAccounts.id, accountId))
        .limit(1);
      if (!identity) {
        throw new IdentityDomainError(
          "ACCOUNT_NOT_FOUND",
          "Akun tidak ditemukan."
        );
      }
      await database
        .update(identityAccounts)
        .set({
          deactivatedAt: now(),
          status: "INACTIVE",
          updatedAt: now(),
        })
        .where(eq(identityAccounts.id, accountId));
      await database.delete(session).where(eq(session.userId, identity.userId));
      await recordSecurityEvent({
        database,
        eventType: "IDENTITY_ACCOUNT_DEACTIVATED",
        metadata: { actorUserId },
        now: now(),
        userId: identity.userId,
      });
    },
    endProgramHead: async ({ assignedBy, endsAt, id }) => {
      const [assignment] = await database
        .select()
        .from(programHeads)
        .where(eq(programHeads.id, id))
        .limit(1);
      if (!assignment || assignment.endsAt) {
        throw new IdentityDomainError(
          "PROGRAM_HEAD_NOT_ACTIVE",
          "Assignment Kaprodi tidak aktif atau tidak ditemukan."
        );
      }
      if (endsAt <= assignment.startsAt) {
        throw new IdentityDomainError(
          "INVALID_PROGRAM_HEAD_DATES",
          "Tanggal akhir assignment harus setelah tanggal mulai."
        );
      }
      await database
        .update(programHeads)
        .set({ endsAt })
        .where(eq(programHeads.id, id));
      await database
        .update(userScopes)
        .set({ endsAt })
        .where(
          and(
            eq(userScopes.scopeId, assignment.prodiId),
            eq(userScopes.scopeType, "PRODI"),
            eq(userScopes.startsAt, assignment.startsAt),
            eq(userScopes.userId, assignment.userId)
          )
        );
      await recordSecurityEvent({
        database,
        eventType: "PROGRAM_HEAD_ENDED",
        metadata: { assignedBy, assignmentId: id },
        now: now(),
        userId: assignment.userId,
      });
      const remainingAssignments = await database
        .select({
          endsAt: programHeads.endsAt,
          startsAt: programHeads.startsAt,
        })
        .from(programHeads)
        .where(eq(programHeads.userId, assignment.userId));
      const currentTime = now();
      const hasRemainingAssignment = remainingAssignments.some(
        (item) =>
          item.startsAt > currentTime ||
          item.endsAt === null ||
          item.endsAt > currentTime
      );
      if (!hasRemainingAssignment) {
        await database
          .update(userRoles)
          .set({ isActive: false })
          .where(
            and(
              eq(userRoles.userId, assignment.userId),
              eq(userRoles.roleKey, "KAPRODI"),
              eq(userRoles.isActive, true)
            )
          );
        await recordSecurityEvent({
          database,
          eventType: "ROLE_REVOKED",
          metadata: { assignedBy, roleKey: "KAPRODI" },
          now: currentTime,
          userId: assignment.userId,
        });
      }
    },
    getContact: async ({ userId }) => {
      const [record] = await database
        .select({
          email: user.email,
          emailVerified: user.emailVerified,
          phone: identityAccounts.phone,
        })
        .from(user)
        .innerJoin(identityAccounts, eq(identityAccounts.userId, user.id))
        .where(eq(user.id, userId))
        .limit(1);
      if (!record) {
        throw new IdentityDomainError(
          "ACCOUNT_NOT_FOUND",
          "Akun tidak ditemukan."
        );
      }
      const [pending] = await database
        .select({
          expiresAt: emailChangeRequests.expiresAt,
          newEmail: emailChangeRequests.newEmail,
        })
        .from(emailChangeRequests)
        .where(
          and(
            eq(emailChangeRequests.userId, userId),
            eq(emailChangeRequests.status, "PENDING")
          )
        )
        .orderBy(desc(emailChangeRequests.createdAt))
        .limit(1);
      return {
        email: record.email,
        emailVerified: record.emailVerified,
        pendingEmail: pending?.newEmail ?? null,
        pendingEmailExpiresAt: pending?.expiresAt ?? null,
        phone: record.phone,
      };
    },
    listProgramHeads: () =>
      database
        .select({
          assignedAt: programHeads.assignedAt,
          endsAt: programHeads.endsAt,
          id: programHeads.id,
          prodiCode: studyPrograms.code,
          prodiId: programHeads.prodiId,
          prodiName: studyPrograms.name,
          startsAt: programHeads.startsAt,
          userId: programHeads.userId,
          userIdentifier: identityAccounts.identifier,
          userName: user.name,
        })
        .from(programHeads)
        .innerJoin(studyPrograms, eq(studyPrograms.id, programHeads.prodiId))
        .innerJoin(user, eq(user.id, programHeads.userId))
        .innerJoin(
          identityAccounts,
          eq(identityAccounts.userId, programHeads.userId)
        )
        .orderBy(desc(programHeads.startsAt)),
    previewBulkAccounts: async ({ identityType, masterRecordIds }) => {
      if (identityType === "MAHASISWA") {
        throw new IdentityDomainError(
          "BULK_IDENTIFIER_REQUIRED",
          "Preview massal Mahasiswa menggunakan NIM dari Master Data."
        );
      }
      const prefix = generatedPrefixes[identityType];
      const sequenceDate = getDateInTimeZone(now(), timeZone);
      const [currentSequence] = await database
        .select({ nextValue: identifierSequences.nextValue })
        .from(identifierSequences)
        .where(
          and(
            eq(identifierSequences.prefix, prefix),
            eq(identifierSequences.sequenceDate, sequenceDate)
          )
        )
        .limit(1);
      return previewIdentifierAllocations({
        masterRecordIds,
        prefix,
        sequenceDate,
        startSequence: currentSequence?.nextValue ?? 1,
      });
    },
    provisionBulkAccounts: async ({
      actorUserId,
      emailByMasterRecordId,
      identityType,
      masterRecords,
    }) => {
      const sortedRecords = masterRecords.toSorted((a, b) =>
        a.masterRecordId.localeCompare(b.masterRecordId)
      );
      const results: unknown[] = [];
      for (const record of sortedRecords) {
        // The sequence must follow the deterministic master-record order.
        // eslint-disable-next-line no-await-in-loop
        const result = await createAccount({
          actorUserId,
          email: emailByMasterRecordId?.[record.masterRecordId],
          identityType,
          masterRecordId: record.masterRecordId,
          name: record.name,
        });
        results.push(result);
      }
      return results;
    },
    requestEmailChange: async ({ currentPassword, newEmail, userId }) => {
      await assertCurrentPassword(auth, userId, currentPassword);
      const normalizedEmail = newEmail.trim().toLowerCase();
      const currentUser = await auth.$context.then((context) =>
        context.internalAdapter.findUserById(userId)
      );
      if (!currentUser) {
        throw new IdentityDomainError(
          "ACCOUNT_NOT_FOUND",
          "Akun tidak ditemukan."
        );
      }
      if (currentUser.email === normalizedEmail) {
        throw new IdentityDomainError(
          "EMAIL_UNCHANGED",
          "Email baru harus berbeda dari email saat ini."
        );
      }
      const existingUser = await auth.$context.then((context) =>
        context.internalAdapter.findUserByEmail(normalizedEmail, {
          includeAccounts: false,
        })
      );
      if (existingUser && existingUser.user.id !== userId) {
        throw new IdentityDomainError(
          "EMAIL_ALREADY_USED",
          "Email tersebut sudah digunakan oleh akun lain."
        );
      }
      const currentTime = now();
      const expiresAt = new Date(
        currentTime.getTime() + DEFAULT_EMAIL_CHANGE_TTL_MS
      );
      await database
        .update(emailChangeRequests)
        .set({ status: "REPLACED" })
        .where(
          and(
            eq(emailChangeRequests.userId, userId),
            eq(emailChangeRequests.status, "PENDING")
          )
        );
      const verificationToken = `${createUuidV7()}${createUuidV7()}`;
      await database.insert(emailChangeRequests).values({
        createdAt: currentTime,
        expiresAt,
        id: createUuidV7(),
        newEmail: normalizedEmail,
        status: "PENDING",
        userId,
        verificationTokenHash: await hashVerificationToken(verificationToken),
      });
      await recordSecurityEvent({
        database,
        eventType: "EMAIL_CHANGE_REQUESTED",
        metadata: { userId },
        now: currentTime,
        userId,
      });
      return {
        email: normalizedEmail,
        expiresAt,
        status: "PENDING_VERIFICATION" as const,
      };
    },
    resetPassword: async ({ accountId, actorIdentityType, actorUserId }) => {
      const [identity] = await database
        .select({
          identityType: identityAccounts.identityType,
          userId: identityAccounts.userId,
        })
        .from(identityAccounts)
        .where(eq(identityAccounts.id, accountId))
        .limit(1);
      if (!identity) {
        throw new IdentityDomainError(
          "ACCOUNT_NOT_FOUND",
          "Akun tidak ditemukan."
        );
      }
      assertResetPasswordPermission(
        actorIdentityType,
        identity.identityType as IdentityType
      );
      const temporaryPassword = createTemporaryPassword();
      const authContext = await auth.$context;
      const password = await authContext.password.hash(temporaryPassword);
      await authContext.internalAdapter.updatePassword(
        identity.userId,
        password
      );
      await database.delete(session).where(eq(session.userId, identity.userId));
      await database
        .update(identityAccounts)
        .set({
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(
            now().getTime() + DEFAULT_TEMPORARY_PASSWORD_TTL_MS
          ),
          updatedAt: now(),
        })
        .where(eq(identityAccounts.id, accountId));
      await recordSecurityEvent({
        database,
        eventType: "PASSWORD_RESET",
        metadata: { actorUserId },
        now: now(),
        userId: identity.userId,
      });
      return { temporaryPassword };
    },
    revokeRole: async ({ roleKey, userId }) => {
      if (roleKey === "DOSEN") {
        const [kaprodi] = await database
          .select({ id: userRoles.id })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, userId),
              eq(userRoles.roleKey, "KAPRODI"),
              eq(userRoles.isActive, true)
            )
          )
          .limit(1);
        if (kaprodi) {
          throw new IdentityDomainError(
            "ROLE_DEPENDENCY",
            "Role DOSEN tidak dapat dicabut selama assignment KAPRODI aktif."
          );
        }
      }
      await database
        .update(userRoles)
        .set({ isActive: false })
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleKey, roleKey),
            eq(userRoles.isActive, true)
          )
        );
      await recordSecurityEvent({
        database,
        eventType: "ROLE_REVOKED",
        metadata: { roleKey },
        now: now(),
        userId,
      });
    },
    revokeScope: async ({ id, userId }) => {
      await database
        .delete(userScopes)
        .where(and(eq(userScopes.id, id), eq(userScopes.userId, userId)));
    },
    updatePhone: async ({ currentPassword, phone, userId }) => {
      await assertCurrentPassword(auth, userId, currentPassword);
      const normalizedPhone =
        phone === null ? null : normalizePhoneNumber(phone);
      const currentTime = now();
      await database
        .update(identityAccounts)
        .set({ phone: normalizedPhone, updatedAt: currentTime })
        .where(eq(identityAccounts.userId, userId));
      await recordSecurityEvent({
        database,
        eventType: "PHONE_CHANGED",
        metadata: { userId },
        now: currentTime,
        userId,
      });
      return { phone: normalizedPhone };
    },
  };
};

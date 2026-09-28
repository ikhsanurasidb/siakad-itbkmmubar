import type { IdentityService } from "@siakad-itbkmmubar/api/context";
import {
  DEFAULT_TEMPORARY_PASSWORD_TTL_MS,
  IDENTIFIER_SEQUENCE_MAX,
  IdentityDomainError,
  assertKnownRole,
  assertRoleConflictFree,
  formatInstitutionalIdentifier,
  getJakartaDate,
  normalizeIdentifier,
  previewIdentifierAllocations,
} from "@siakad-itbkmmubar/api/identity";
import type { IdentityType, RoleKey } from "@siakad-itbkmmubar/api/identity";
import type { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";
import { session, user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  identityAccounts,
  identifierReservations,
  identifierSequences,
  programHeads,
  roles,
  securityEvents,
  userRoles,
  userScopes,
} from "@siakad-itbkmmubar/db/schema/identity";
import { and, eq, isNull, sql } from "drizzle-orm";

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
}: {
  database: Database;
  idempotencyKey: string;
  masterRecordId: string;
  now: Date;
  prefix: string;
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

  const sequenceDate = getJakartaDate(now);
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
  const reservationId = crypto.randomUUID();

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
    id: crypto.randomUUID(),
    metadata: JSON.stringify(metadata),
    userId,
  });
};

export const createIdentityService = ({
  auth,
  database,
  now = () => new Date(),
}: {
  auth: ConfiguredAuth;
  database: Database;
  now?: () => Date;
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
      const masterRecordId = input.masterRecordId ?? crypto.randomUUID();
      const reservation = await reserveGeneratedIdentifier({
        database,
        idempotencyKey: `provision:${masterRecordId}`,
        masterRecordId,
        now: currentTime,
        prefix,
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

      const accountId = crypto.randomUUID();
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
        id: crypto.randomUUID(),
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
    await createIdentityService({ auth, database, now }).assignRole(input);
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
      const [dosenRole] = await database
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.roleKey, "DOSEN"),
            eq(userRoles.isActive, true)
          )
        )
        .limit(1);
      if (!dosenRole) {
        throw new IdentityDomainError(
          "PROGRAM_HEAD_REQUIRES_DOSEN",
          "Kaprodi hanya dapat ditetapkan pada akun Dosen."
        );
      }
      await database
        .update(programHeads)
        .set({ endsAt: startsAt })
        .where(
          and(eq(programHeads.prodiId, prodiId), isNull(programHeads.endsAt))
        );
      await database.insert(programHeads).values({
        assignedAt: now(),
        assignedBy,
        endsAt,
        id: crypto.randomUUID(),
        prodiId,
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
      await thisAssignRole({ assignedBy, roleKey: "KAPRODI", userId });
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
    endProgramHead: async ({ endsAt, id }) => {
      await database
        .update(programHeads)
        .set({ endsAt })
        .where(and(eq(programHeads.id, id), isNull(programHeads.endsAt)));
    },
    previewBulkAccounts: async ({ identityType, masterRecordIds }) => {
      if (identityType === "MAHASISWA") {
        throw new IdentityDomainError(
          "BULK_IDENTIFIER_REQUIRED",
          "Preview massal Mahasiswa menggunakan NIM dari Master Data."
        );
      }
      const prefix = generatedPrefixes[identityType];
      const sequenceDate = getJakartaDate(now());
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
    resetPassword: async ({ accountId, actorUserId }) => {
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
  };
};

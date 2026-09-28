import type { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";
import { user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  identityAccounts,
  securityEvents,
  userRoles,
} from "@siakad-itbkmmubar/db/schema/identity";
import { eq } from "drizzle-orm";

const MINIMUM_PASSWORD_LENGTH = 16;
const DEFAULT_SUPERADMIN_NAME = "Superadmin";
const DEFAULT_SUPERADMIN_IDENTIFIER = "SUP20260928001";
const DEFAULT_SUPERADMIN_EMAIL = "superadmin@account.siakad.local";

type ConfiguredAuth = ReturnType<typeof createConfiguredAuth>;

export class BootstrapSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapSeedError";
  }
}

export interface SuperadminSeedInput {
  email?: string;
  identifier?: string;
  name?: string;
  password: string;
}

export interface SuperadminSeedResult {
  created: boolean;
  identifier: string;
}

export const seedSuperadmin = async ({
  auth,
  database,
  input,
  now = new Date(),
}: {
  auth: ConfiguredAuth;
  database: Database;
  input: SuperadminSeedInput;
  now?: Date;
}): Promise<SuperadminSeedResult> => {
  if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new BootstrapSeedError(
      `Password seed minimal ${MINIMUM_PASSWORD_LENGTH} karakter.`
    );
  }

  const [existingAccount] = await database
    .select({ identifier: identityAccounts.identifier })
    .from(identityAccounts)
    .limit(1);
  if (existingAccount) {
    throw new BootstrapSeedError(
      "Seed superadmin hanya dapat dijalankan saat belum ada akun identitas."
    );
  }

  const identifier = (input.identifier ?? DEFAULT_SUPERADMIN_IDENTIFIER)
    .trim()
    .toUpperCase();
  const name = input.name?.trim() || DEFAULT_SUPERADMIN_NAME;
  const email = input.email?.trim().toLowerCase() || DEFAULT_SUPERADMIN_EMAIL;
  const authContext = await auth.$context;
  let userId: string | null = null;

  try {
    const createdUser = await authContext.internalAdapter.createUser(
      {
        email,
        emailVerified: true,
        name,
        username: identifier,
      },
      { method: "admin" }
    );
    userId = createdUser.id;

    await authContext.internalAdapter.linkAccount({
      accountId: userId,
      password: await authContext.password.hash(input.password),
      providerId: "credential",
      userId,
    });

    await database.insert(identityAccounts).values({
      createdAt: now,
      id: crypto.randomUUID(),
      identifier,
      identityType: "SUPERADMIN",
      mustChangePassword: false,
      status: "ACTIVE",
      updatedAt: now,
      userId,
    });
    await database.insert(userRoles).values({
      assignedAt: now,
      id: crypto.randomUUID(),
      isActive: true,
      roleKey: "SUPERADMIN",
      userId,
    });
    await database.insert(securityEvents).values({
      createdAt: now,
      eventType: "IDENTITY_ACCOUNT_SEEDED",
      id: crypto.randomUUID(),
      metadata: JSON.stringify({ identifier }),
      userId,
    });
  } catch (error) {
    if (userId) {
      await database.delete(user).where(eq(user.id, userId));
    }
    throw error;
  }

  return { created: true, identifier };
};

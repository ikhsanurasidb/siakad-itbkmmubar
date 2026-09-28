import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@siakad-itbkmmubar/db";
import * as schema from "@siakad-itbkmmubar/db/schema/auth";
import { identityAccounts } from "@siakad-itbkmmubar/db/schema/identity";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins/username";
import { eq } from "drizzle-orm";

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
}

export interface AuthPolicy {
  idleTimeoutHours: number;
  lockWindowMinutes: number;
  loginRateLimitAttempts: number;
  passwordMinimumLength: number;
  refreshIntervalMinutes: number;
}

export const createAuth = (
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
  policy?: AuthPolicy
) => {
  const resolvedPolicy = policy ?? {
    idleTimeoutHours: 72,
    lockWindowMinutes: 1,
    loginRateLimitAttempts: 5,
    passwordMinimumLength: 16,
    refreshIntervalMinutes: 60,
  };
  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (newSession) => {
            const [identity] = await database
              .select()
              .from(identityAccounts)
              .where(eq(identityAccounts.userId, newSession.userId))
              .limit(1);
            if (!identity || identity.status !== "ACTIVE") {
              return false;
            }
            if (
              identity.mustChangePassword &&
              identity.temporaryPasswordExpiresAt &&
              identity.temporaryPasswordExpiresAt <= new Date()
            ) {
              return false;
            }
          },
        },
      },
    },
    emailAndPassword: {
      disableSignUp: false,
      enabled: true,
      minPasswordLength: resolvedPolicy.passwordMinimumLength,
    },
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
        maxUsernameLength: 32,
        minUsernameLength: 3,
        usernameNormalization: (value) => value.trim().toUpperCase(),
        usernameValidator: (value) => /^[A-Z0-9]+$/u.test(value),
        validationOrder: {
          username: "post-normalization",
        },
      }),
    ],
    rateLimit: {
      customRules: {
        "/get-session": false,
      },
      enabled: true,
      max: resolvedPolicy.loginRateLimitAttempts,
      storage: "database",
      window: resolvedPolicy.lockWindowMinutes * 60,
    },
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: 60 * 60 * resolvedPolicy.idleTimeoutHours,
      updateAge: 60 * resolvedPolicy.refreshIntervalMinutes,
    },
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
  });
};

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];

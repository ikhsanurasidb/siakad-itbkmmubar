import {
  createIdentityService,
  createMasterDataService,
  getDb,
  createAuth,
} from "@server/services";
import { createServerLogger } from "@server/services/logger";
import type { Context as ApiContext } from "@siakad-itbkmmubar/api/context";
import type { IdentityType } from "@siakad-itbkmmubar/api/identity";
import {
  roleKeys,
  identityAccounts,
  userRoles,
} from "@siakad-itbkmmubar/db/schema/identity";
import { eq } from "drizzle-orm";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext;
  logger?: ApiContext["logger"];
  requestId?: string;
}

export const createContext = async ({
  context,
  logger,
  requestId = crypto.randomUUID(),
}: CreateContextOptions): Promise<ApiContext> => {
  const db = await getDb();
  const auth = await createAuth(db);
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  const identityService = await createIdentityService(db);
  const masterDataService = await createMasterDataService(db);
  let identity: ApiContext["identity"] = null;
  if (session?.user) {
    const [account] = await db
      .select()
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, session.user.id))
      .limit(1);
    if (account) {
      const roleRows = await db
        .select({ roleKey: userRoles.roleKey })
        .from(userRoles)
        .where(eq(userRoles.userId, session.user.id));
      const activeRoles = roleRows
        .filter((role) =>
          roleKeys.includes(role.roleKey as (typeof roleKeys)[number])
        )
        .map((role) => role.roleKey as (typeof roleKeys)[number]);
      identity = {
        accountId: account.id,
        identifier: account.identifier,
        identityType: account.identityType as IdentityType,
        mustChangePassword: account.mustChangePassword,
        roles: activeRoles,
        status: account.status as "ACTIVE" | "INACTIVE",
        userId: account.userId,
      };
    }
  }
  const request = {
    method: context.req.method,
    path: context.req.path,
    requestId,
  };

  return {
    clock: { now: () => new Date() },
    db,
    identity,
    identityService,
    logger: (logger ?? createServerLogger()).child({
      method: request.method,
      path: request.path,
      requestId,
    }),
    masterDataService,
    request,
    session,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

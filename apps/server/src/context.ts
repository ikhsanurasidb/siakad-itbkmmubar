import { getDb, createAuth } from "@server/services";
import { createServerLogger } from "@server/services/logger";
import type { Context as ApiContext } from "@siakad-itbkmmubar/api/context";
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
  const request = {
    method: context.req.method,
    path: context.req.path,
    requestId,
  };

  return {
    clock: { now: () => new Date() },
    db,
    logger: (logger ?? createServerLogger()).child({
      method: request.method,
      path: request.path,
      requestId,
    }),
    request,
    session,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

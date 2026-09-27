import type { Context as ApiContext } from "@siakad-itbkmmubar/api/context";
import type { Context as HonoContext } from "hono";

import { getDb, createAuth } from "./services";

export interface CreateContextOptions {
  context: HonoContext;
}

export const createContext = async ({
  context,
}: CreateContextOptions): Promise<ApiContext> => {
  const db = await getDb();
  const auth = await createAuth(db);
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

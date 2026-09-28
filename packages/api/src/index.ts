import type { Context } from "@api/context";
import { ORPCError, os } from "@orpc/server";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

const requireFullAccess = o.middleware(({ context, next }) => {
  if (!context.identity || context.identity.status !== "ACTIVE") {
    throw new ORPCError("FORBIDDEN");
  }
  if (context.identity.mustChangePassword) {
    throw new ORPCError("FORBIDDEN", {
      message: "Ganti kata sandi wajib diselesaikan sebelum membuka layanan.",
    });
  }
  return next();
});

export const authenticatedProcedure = publicProcedure.use(requireAuth);
export const protectedProcedure = authenticatedProcedure.use(requireFullAccess);

export { ApiError, getApiErrorPayload } from "@api/errors";

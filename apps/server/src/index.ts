import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@server/context";
import { ENV } from "@server/env.server";
import { createAuth, seedData, seedSuperadmin } from "@server/services";
import { BootstrapSeedError } from "@server/services/bootstrap";
import { createServerLogger } from "@server/services/logger";
import type { LogFormat, LogLevel } from "@server/services/logger";
import { DataSeedError } from "@server/services/seed-data";
import { getApiErrorPayload } from "@siakad-itbkmmubar/api/errors";
import { appRouter } from "@siakad-itbkmmubar/api/routers/index";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface AppEnv {
  Variables: {
    logger: ReturnType<typeof createServerLogger>;
    requestId: string;
  };
}

const app = new Hono<AppEnv>();
const serverLogger = createServerLogger({
  baseContext: {
    deploymentVersion: ENV.DEPLOYMENT_VERSION,
    environment: ENV.LOG_FORMAT === "json" ? "production" : "development",
  },
  format: ENV.LOG_FORMAT as LogFormat,
  level: ENV.LOG_LEVEL as LogLevel,
});

const isLocalDevelopment = (): boolean => {
  if (ENV.NODE_ENV === "development") {
    return true;
  }

  try {
    return new URL(ENV.CORS_ORIGIN).hostname === "localhost";
  } catch {
    return false;
  }
};

app.use("/*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? createUuidV7();
  const requestLogger = serverLogger.child({
    method: c.req.method,
    path: c.req.path,
    requestId,
  });
  const startedAt = performance.now();

  c.header("x-request-id", requestId);
  c.header("Permissions-Policy", "camera=(self), microphone=()");
  c.set("logger", requestLogger);
  c.set("requestId", requestId);

  try {
    return await next();
  } finally {
    requestLogger.info("request.completed", {
      durationMs: Math.round(performance.now() - startedAt),
      status: c.res.status,
    });
  }
});

app.use(
  "/*",
  cors({
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Active-Role",
      "X-Request-Id",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    origin: ENV.CORS_ORIGIN,
  })
);

app.onError((error, c) => {
  const requestId = c.get("requestId") ?? createUuidV7();
  const requestLogger = c.get("logger") ?? serverLogger;
  requestLogger.error("request.internal_error", error, {
    method: c.req.method,
    path: c.req.path,
    requestId,
  });

  c.header("x-request-id", requestId);
  return c.json(getApiErrorPayload(error, requestId), 500);
});

app.on("POST", "/api/auth/sign-up/email", (c) =>
  c.json(
    {
      message: "Pembuatan akun hanya dapat dilakukan melalui provisioning.",
    },
    404
  )
);

app.post("/api/seed/superadmin", async (c) => {
  const requestLogger = c.get("logger") ?? serverLogger;
  if (!isLocalDevelopment()) {
    requestLogger.warn("seed.superadmin_attempted_outside_local_development", {
      method: c.req.method,
    });
    return c.json(
      { message: "Seed hanya tersedia pada environment development." },
      404
    );
  }

  const body = await c.req.json<{
    email?: string;
    identifier?: string;
    name?: string;
    password?: string;
  }>();
  if (!body.password) {
    return c.json({ message: "Password seed wajib diisi." }, 400);
  }

  try {
    const result = await seedSuperadmin({
      email: body.email,
      identifier: body.identifier,
      name: body.name,
      password: body.password,
    });
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof BootstrapSeedError) {
      return c.json({ message: error.message }, 409);
    }
    throw error;
  }
});

app.post("/api/seed/data", async (c) => {
  const requestLogger = c.get("logger") ?? serverLogger;
  if (!isLocalDevelopment()) {
    requestLogger.warn("seed.data_attempted_outside_local_development", {
      method: c.req.method,
    });
    return c.json(
      { message: "Seed hanya tersedia pada environment development." },
      404
    );
  }

  const body = await c.req.json<{ password?: string }>();
  if (!body.password) {
    return c.json({ message: "Password seed wajib diisi." }, 400);
  }

  try {
    const result = await seedData({ password: body.password });
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof DataSeedError) {
      return c.json({ message: error.message }, 409);
    }
    throw error;
  }
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const auth = await createAuth();
  return auth.handler(c.req.raw);
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      serverLogger.error("openapi.internal_error", error);
    }),
  ],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      serverLogger.error("rpc.internal_error", error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({
    context: c,
    logger: c.get("logger"),
    requestId: c.get("requestId"),
  });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    context,
    prefix: "/rpc",
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    context,
    prefix: "/api-reference",
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  return next();
});

app.get("/api/curriculum/:curriculumId/document", async (c) => {
  const context = await createContext({
    context: c,
    logger: c.get("logger"),
    requestId: c.get("requestId"),
  });
  if (!context.session?.user || !context.identity) {
    return c.json({ message: "Masuk diperlukan." }, 401);
  }
  try {
    const document = await context.curriculumService.downloadDocument({
      actorRoles: context.identity.roles,
      actorUserId: context.session.user.id,
      curriculumId: c.req.param("curriculumId"),
    });
    return c.body(document.body, 200, {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
      "content-type": document.contentType,
    });
  } catch {
    return c.json({ message: "Dokumen belum dapat diunduh." }, 404);
  }
});

app.get("/api/lms/file/:fileObjectId", async (c) => {
  const context = await createContext({
    context: c,
    logger: c.get("logger"),
    requestId: c.get("requestId"),
  });
  if (!context.session?.user || !context.identity) {
    return c.json({ message: "Masuk diperlukan." }, 401);
  }
  try {
    const file = await context.lmsService.downloadFile({
      actorRoles: context.identity.roles,
      actorUserId: context.session.user.id,
      fileObjectId: c.req.param("fileObjectId"),
    });
    return c.body(file.body, 200, {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "content-type": file.contentType,
    });
  } catch {
    return c.json({ message: "Berkas LMS tidak ditemukan." }, 404);
  }
});

app.get("/api/attendance/evidence/:evidenceId", async (c) => {
  const context = await createContext({
    context: c,
    logger: c.get("logger"),
    requestId: c.get("requestId"),
  });
  if (!context.session?.user || !context.identity) {
    return c.json({ message: "Masuk diperlukan." }, 401);
  }
  try {
    const evidence = await context.attendanceService.downloadEvidence({
      actorRoles: context.identity.roles,
      actorUserId: context.session.user.id,
      evidenceId: c.req.param("evidenceId"),
    });
    return c.body(evidence.body, 200, {
      "cache-control": "private, no-store",
      "content-type": evidence.contentType,
      "x-content-type-options": "nosniff",
    });
  } catch {
    return c.json({ message: "Bukti presensi belum dapat ditampilkan." }, 404);
  }
});

app.get("/", (c) => c.text("OK"));

export default app;

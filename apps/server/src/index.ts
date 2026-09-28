import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@server/context";
import { ENV } from "@server/env.server";
import { createAuth, seedSuperadmin } from "@server/services";
import { BootstrapSeedError } from "@server/services/bootstrap";
import { createServerLogger } from "@server/services/logger";
import type { LogFormat, LogLevel } from "@server/services/logger";
import { getApiErrorPayload } from "@siakad-itbkmmubar/api/errors";
import { appRouter } from "@siakad-itbkmmubar/api/routers/index";
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

app.use("/*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  const requestLogger = serverLogger.child({
    method: c.req.method,
    path: c.req.path,
    requestId,
  });
  const startedAt = performance.now();

  c.header("x-request-id", requestId);
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
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    origin: ENV.CORS_ORIGIN,
  })
);

app.onError((error, c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
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
  if (ENV.NODE_ENV !== "development") {
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

app.get("/", (c) => c.text("OK"));

export default app;

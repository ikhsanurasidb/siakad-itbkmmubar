import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const fileBucket = Cloudflare.R2.Bucket("file-objects");

export const server = Cloudflare.Worker("server", {
  compatibility: {
    flags: ["nodejs_compat"],
  },
  dev: {
    port: 3000,
  },
  env: {
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    DB: db,
    DEPLOYMENT_VERSION: Config.String("DEPLOYMENT_VERSION"),
    LOG_FORMAT: Config.String("LOG_FORMAT"),
    LOG_LEVEL: Config.String("LOG_LEVEL"),
    R2: fileBucket,
  },
  main: "../../apps/server/src/index.ts",
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "siakad-itbkmmubar",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* createStack() {
    const serverWorker = yield* server;
    const webWorker = yield* Cloudflare.Website.Vite("web", {
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
      dev: {
        port: 3001,
      },
      env: {
        VITE_SERVER_URL: serverWorker.url.as<string>(),
      },
      rootDir: "../../apps/web",
    });

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);

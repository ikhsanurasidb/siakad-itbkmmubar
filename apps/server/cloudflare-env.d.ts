import type { ServerEnv } from "@siakad-itbkmmubar/infra/alchemy.run";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/cloudflare/compute/workers

export type CloudflareEnv = ServerEnv;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export type Env = CloudflareEnv;
  }
}

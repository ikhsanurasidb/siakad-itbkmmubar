// Alchemy validates deployment inputs with Varlock; Workers use native env bindings.
import type { PublicCoercedEnvSchema } from "./env";

const serverUrl = import.meta.env.VITE_SERVER_URL;
const businessTimeZone = import.meta.env.VITE_BUSINESS_TIME_ZONE;

if (!serverUrl) {
  throw new Error("VITE_SERVER_URL is not configured");
}
if (!businessTimeZone) {
  throw new Error("VITE_BUSINESS_TIME_ZONE is not configured");
}

export const ENV = {
  VITE_BUSINESS_TIME_ZONE: businessTimeZone,
  VITE_SERVER_URL: serverUrl,
} satisfies Pick<
  PublicCoercedEnvSchema,
  "VITE_BUSINESS_TIME_ZONE" | "VITE_SERVER_URL"
>;

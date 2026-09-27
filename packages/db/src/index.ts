import type { DatabaseConfig } from "@db/config";
import { relations } from "@db/relations";
import { drizzle } from "drizzle-orm/d1";

export const createDb = (env: DatabaseConfig) => drizzle(env.DB, { relations });

export type Database = ReturnType<typeof createDb>;

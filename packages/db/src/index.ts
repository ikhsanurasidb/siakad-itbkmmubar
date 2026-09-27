import { drizzle } from "drizzle-orm/d1";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export const createDb = (env: DatabaseConfig) => drizzle(env.DB, { relations });

export type Database = ReturnType<typeof createDb>;

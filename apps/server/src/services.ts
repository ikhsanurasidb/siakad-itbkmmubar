import { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import { createDb } from "@siakad-itbkmmubar/db";
import type { Database } from "@siakad-itbkmmubar/db";

import { ENV } from "./env.server";

export const getDb = (): Database => createDb(ENV);

export const createAuth = async (database?: Database) =>
  createConfiguredAuth(ENV, database ?? (await getDb()));

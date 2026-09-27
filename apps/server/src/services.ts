import { ENV } from "@server/env.server";
import { createR2FileStorage } from "@server/services/storage";
import { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import { createDb } from "@siakad-itbkmmubar/db";
import type { Database } from "@siakad-itbkmmubar/db";

export const getDb = (): Database => createDb(ENV);

export const createAuth = async (database?: Database) =>
  createConfiguredAuth(ENV, database ?? (await getDb()));

export const getStorage = () => createR2FileStorage(ENV.R2);

import { ENV } from "@server/env.server";
import { seedSuperadmin as seedConfiguredSuperadmin } from "@server/services/bootstrap";
import { createIdentityService as createConfiguredIdentityService } from "@server/services/identity";
import { createR2FileStorage } from "@server/services/storage";
import { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import { createDb } from "@siakad-itbkmmubar/db";
import type { Database } from "@siakad-itbkmmubar/db";

export const getDb = (): Database => createDb(ENV);

export const createAuth = async (database?: Database) =>
  createConfiguredAuth(ENV, database ?? (await getDb()));

export const getStorage = () => createR2FileStorage(ENV.R2);

export const createIdentityService = async (database?: Database) => {
  const db = database ?? (await getDb());
  return createConfiguredIdentityService({
    auth: await createAuth(db),
    database: db,
  });
};

export const seedSuperadmin = async (
  input: Parameters<typeof seedConfiguredSuperadmin>[0]["input"]
) => {
  const database = await getDb();
  return seedConfiguredSuperadmin({
    auth: await createAuth(database),
    database,
    input,
  });
};

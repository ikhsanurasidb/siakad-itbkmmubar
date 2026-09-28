import { ENV } from "@server/env.server";
import { seedSuperadmin as seedConfiguredSuperadmin } from "@server/services/bootstrap";
import { createIdentityService as createConfiguredIdentityService } from "@server/services/identity";
import { createMasterDataService as createConfiguredMasterDataService } from "@server/services/master-data";
import { createSettingsService as createConfiguredSettingsService } from "@server/services/settings";
import { createR2FileStorage } from "@server/services/storage";
import { createAuth as createConfiguredAuth } from "@siakad-itbkmmubar/auth";
import { createDb } from "@siakad-itbkmmubar/db";
import type { Database } from "@siakad-itbkmmubar/db";

export const getDb = (): Database => createDb(ENV);

export const createAuth = async (database?: Database) => {
  const db = database ?? (await getDb());
  const securityPolicy = await createConfiguredSettingsService({
    database: db,
  }).getSecurityPolicy();
  return createConfiguredAuth(ENV, db, [], securityPolicy);
};

export const getStorage = () => createR2FileStorage(ENV.R2);

export const createIdentityService = async (database?: Database) => {
  const db = database ?? (await getDb());
  return createConfiguredIdentityService({
    auth: await createAuth(db),
    database: db,
  });
};

export const createMasterDataService = async (database?: Database) =>
  createConfiguredMasterDataService({
    database: database ?? (await getDb()),
    storage: getStorage(),
  });

export const createSettingsService = async (database?: Database) =>
  createConfiguredSettingsService({ database: database ?? (await getDb()) });

export const seedSuperadmin = async (
  input: Parameters<typeof seedConfiguredSuperadmin>[0]["input"]
) => {
  const database = await getDb();
  const securityPolicy = await createConfiguredSettingsService({
    database,
  }).getSecurityPolicy();
  return seedConfiguredSuperadmin({
    auth: await createAuth(database),
    database,
    input,
    minimumPasswordLength: securityPolicy.passwordMinimumLength,
  });
};

import { ENV } from "@server/env.server";
import { createAttendanceService as createConfiguredAttendanceService } from "@server/services/attendance";
import { seedSuperadmin as seedConfiguredSuperadmin } from "@server/services/bootstrap";
import { createCurriculumService as createConfiguredCurriculumService } from "@server/services/curriculum";
import { createGradesService as createConfiguredGradesService } from "@server/services/grades";
import { createIdentityService as createConfiguredIdentityService } from "@server/services/identity";
import { createLmsService as createConfiguredLmsService } from "@server/services/lms";
import { createMasterDataService as createConfiguredMasterDataService } from "@server/services/master-data";
import { createSchedulingService as createConfiguredSchedulingService } from "@server/services/scheduling";
import { seedData as seedConfiguredData } from "@server/services/seed-data";
import { createSettingsService as createConfiguredSettingsService } from "@server/services/settings";
import { createR2FileStorage } from "@server/services/storage";
import { createStudyPlanService as createConfiguredStudyPlanService } from "@server/services/study-plan";
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

export const createLmsService = async (database?: Database) => {
  const db = database ?? (await getDb());
  return createConfiguredLmsService({ database: db, storage: getStorage() });
};

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

export const createCurriculumService = async (database?: Database) => {
  const db = database ?? (await getDb());
  const settingsService = await createSettingsService(db);
  return createConfiguredCurriculumService({
    database: db,
    getFilePolicy: () => settingsService.getFilePolicy("CURRICULUM"),
    storage: getStorage(),
  });
};

export const createStudyPlanService = async (database?: Database) =>
  createConfiguredStudyPlanService({ database: database ?? (await getDb()) });

export const createSchedulingService = async (database?: Database) => {
  const db = database ?? (await getDb());
  const settingsService = await createSettingsService(db);
  return createConfiguredSchedulingService({
    database: db,
    getSchedulingPolicy: () => settingsService.getSchedulingPolicy(),
  });
};

export const createGradesService = async (database?: Database) => {
  const db = database ?? (await getDb());
  const settingsService = await createSettingsService(db);
  return createConfiguredGradesService({
    database: db,
    getGradingPolicy: (asOf) =>
      settingsService.getGradingPolicy(undefined, asOf),
  });
};

export const createAttendanceService = async (database?: Database) => {
  const db = database ?? (await getDb());
  const settingsService = await createSettingsService(db);
  return createConfiguredAttendanceService({
    database: db,
    getAttendancePolicy: () => settingsService.getAttendancePolicy(),
    storage: getStorage(),
  });
};

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

export const seedData = async (
  input: Parameters<typeof seedConfiguredData>[0]["input"]
) => {
  const database = await getDb();
  return seedConfiguredData({
    auth: await createAuth(database),
    database,
    input,
    now: new Date(),
  });
};

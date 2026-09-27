import {
  account,
  authRelations,
  session,
  user,
  verification,
} from "@db/schema/auth";
import {
  auditLogs,
  backgroundJobs,
  fileObjects,
  idempotencyKeys,
  notifications,
  outboxEvents,
} from "@db/schema/platform";
import { defineRelations } from "drizzle-orm";

const schema = {
  account,
  auditLogs,
  backgroundJobs,
  fileObjects,
  idempotencyKeys,
  notifications,
  outboxEvents,
  session,
  user,
  verification,
};

export const relations = {
  ...defineRelations(schema),
  ...authRelations,
};

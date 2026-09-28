import {
  account,
  authRelations,
  rateLimit,
  session,
  user,
  verification,
} from "@db/schema/auth";
import {
  identityAccounts,
  identifierReservations,
  identifierSequences,
  permissions,
  programHeads,
  roleConflicts,
  rolePermissions,
  roles,
  securityEvents,
  userRoles,
  userScopes,
} from "@db/schema/identity";
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
  identifierReservations,
  identifierSequences,
  identityAccounts,
  notifications,
  outboxEvents,
  permissions,
  programHeads,
  rateLimit,
  roleConflicts,
  rolePermissions,
  roles,
  securityEvents,
  session,
  user,
  userRoles,
  userScopes,
  verification,
};

export const relations = {
  ...defineRelations(schema),
  ...authRelations,
};

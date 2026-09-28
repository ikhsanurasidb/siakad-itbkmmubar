import type { IdentityType, RoleKey } from "@api/identity";
import type { Session } from "@siakad-itbkmmubar/auth";
import type { Database } from "@siakad-itbkmmubar/db";

export interface Clock {
  now: () => Date;
}

export interface RequestMetadata {
  method: string;
  path: string;
  requestId: string;
}

export interface IdentityAccess {
  accountId: string;
  identityType: IdentityType;
  identifier: string;
  mustChangePassword: boolean;
  roles: readonly RoleKey[];
  status: "ACTIVE" | "INACTIVE";
  userId: string;
}

export interface IdentityService {
  assignProgramHead: (input: {
    assignedBy: string;
    endsAt: Date | null;
    prodiId: string;
    startsAt: Date;
    userId: string;
  }) => Promise<unknown>;
  assignRole: (input: {
    assignedBy: string;
    roleKey: RoleKey;
    userId: string;
  }) => Promise<unknown>;
  assignScope: (input: {
    endsAt: Date | null;
    scopeId: string;
    scopeType: "PRODI" | "KELAS" | "OWNERSHIP";
    startsAt: Date;
    userId: string;
  }) => Promise<unknown>;
  activateAccount: (input: {
    accountId: string;
    actorUserId: string;
  }) => Promise<void>;
  completeFirstLogin: (userId: string) => Promise<void>;
  createAccount: (input: {
    actorUserId: string;
    email?: string;
    identityType: IdentityType;
    identifier?: string;
    masterRecordId?: string;
    name: string;
    roleKey?: RoleKey;
  }) => Promise<{
    identifier: string;
    temporaryPassword: string;
    userId: string;
  }>;
  deactivateAccount: (input: {
    accountId: string;
    actorUserId: string;
  }) => Promise<void>;
  endProgramHead: (input: {
    assignedBy: string;
    id: string;
    endsAt: Date;
  }) => Promise<void>;
  previewBulkAccounts: (input: {
    identityType: IdentityType;
    masterRecordIds: readonly string[];
  }) => Promise<readonly unknown[]>;
  provisionBulkAccounts: (input: {
    actorUserId: string;
    emailByMasterRecordId?: Readonly<Record<string, string>>;
    identityType: IdentityType;
    masterRecords: readonly {
      masterRecordId: string;
      name: string;
    }[];
  }) => Promise<readonly unknown[]>;
  resetPassword: (input: {
    accountId: string;
    actorUserId: string;
  }) => Promise<{ temporaryPassword: string }>;
  revokeRole: (input: {
    assignedBy: string;
    roleKey: RoleKey;
    userId: string;
  }) => Promise<void>;
  revokeScope: (input: { id: string; userId: string }) => Promise<void>;
}

export interface ServerLogger {
  debug: (event: string, context?: Record<string, unknown>) => void;
  info: (event: string, context?: Record<string, unknown>) => void;
  warn: (event: string, context?: Record<string, unknown>) => void;
  error: (
    event: string,
    error: unknown,
    context?: Record<string, unknown>
  ) => void;
  child: (context: Record<string, unknown>) => ServerLogger;
}

export interface Context {
  db: Database;
  clock: Clock;
  logger: ServerLogger;
  request: RequestMetadata;
  identity: IdentityAccess | null;
  identityService: IdentityService;
  session: Session | null;
}

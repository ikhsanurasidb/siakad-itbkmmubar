import type { Context } from "@api/context";
import {
  identityTypes,
  maskIpAddress,
  roleKeys,
  scopeTypes,
} from "@api/identity";
import {
  authenticatedProcedure,
  protectedProcedure,
  publicProcedure,
} from "@api/index";
import {
  MASTER_DATA_TEMPLATE_VERSION,
  templateHeaders,
  masterDataEntityTypes,
  masterDataStatusesList,
} from "@api/master-data";
import { settingCategories, settingScopeTypes } from "@api/settings";
import type { GradeScaleEntry } from "@api/settings";
import type { RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { session, user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  identityAccounts,
  roles,
  userScopes,
} from "@siakad-itbkmmubar/db/schema/identity";
import { identifierUsages as masterIdentifierUsages } from "@siakad-itbkmmubar/db/schema/master-data";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

const identityTypeSchema = z.enum(identityTypes);
const roleKeySchema = z.enum(roleKeys);
const scopeTypeSchema = z.enum(scopeTypes);
const dateSchema = z.coerce.date();

const requireRole = (context: Context, allowedRoles: readonly string[]) => {
  if (!context.identity?.roles.some((role) => allowedRoles.includes(role))) {
    throw new ORPCError("FORBIDDEN");
  }
};

const requireIdentityService = (context: Context) => context.identityService;

const accountIdInput = z.object({ accountId: z.string().min(1) });
const masterDataEntitySchema = z.enum(masterDataEntityTypes);
const masterDataStatusSchema = z.enum(masterDataStatusesList);
const masterDataDataSchema = z.record(z.string(), z.unknown());
const settingCategorySchema = z.enum(settingCategories);
const settingScopeTypeSchema = z.enum(settingScopeTypes);
const settingsScopeSchema = z.object({
  scopeId: z.string().trim().default(""),
  scopeType: settingScopeTypeSchema.default("SYSTEM"),
});
const settingValuesSchema = z.record(z.string(), z.unknown());
const gradeScaleEntriesSchema = z.array(
  z.object({
    gradeCode: z.string().trim().min(1).max(10),
    label: z.string().trim().min(1).max(80),
    maxScore: z.number().finite().min(0).max(100),
    minScore: z.number().finite().min(0).max(100),
    qualityPoints: z.number().finite().min(0).max(4),
  })
);

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  identity: {
    accounts: {
      activate: protectedProcedure
        .input(accountIdInput)
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          await requireIdentityService(context).activateAccount({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
          return { status: "ACTIVE" as const };
        }),
      bulkCommit: protectedProcedure
        .input(
          z.object({
            identityType: identityTypeSchema,
            masterRecords: z
              .array(
                z.object({
                  masterRecordId: z.string().min(1),
                  name: z.string().trim().min(1),
                })
              )
              .min(1)
              .max(100),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return requireIdentityService(context).provisionBulkAccounts({
            actorUserId: context.session?.user.id as string,
            identityType: input.identityType,
            masterRecords: input.masterRecords,
          });
        }),
      bulkPreview: protectedProcedure
        .input(
          z.object({
            identityType: identityTypeSchema,
            masterRecordIds: z.array(z.string().min(1)).min(1).max(100),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return requireIdentityService(context).previewBulkAccounts(input);
        }),
      create: protectedProcedure
        .input(
          z.object({
            email: z.email().optional(),
            identifier: z.string().trim().min(3).optional(),
            identityType: identityTypeSchema,
            masterRecordId: z.string().trim().min(1).optional(),
            name: z.string().trim().min(1),
            roleKey: roleKeySchema.optional(),
          })
        )
        .handler(({ context, input }) => {
          const actorRoles = context.identity?.roles ?? [];
          const allowed =
            actorRoles.includes("SUPERADMIN") ||
            (actorRoles.includes("ADMIN_AKADEMIK") &&
              (input.identityType === "MAHASISWA" ||
                input.identityType === "DOSEN"));
          if (!allowed) {
            throw new ORPCError("FORBIDDEN");
          }
          return requireIdentityService(context).createAccount({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
        }),
      deactivate: protectedProcedure
        .input(accountIdInput)
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          await requireIdentityService(context).deactivateAccount({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
          return { status: "INACTIVE" as const };
        }),
      detail: protectedProcedure
        .input(accountIdInput)
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          const [result] = await context.db
            .select({
              account: identityAccounts,
              name: user.name,
              username: user.username,
            })
            .from(identityAccounts)
            .innerJoin(user, eq(user.id, identityAccounts.userId))
            .where(eq(identityAccounts.id, input.accountId))
            .limit(1);
          if (!result) {
            throw new ORPCError("NOT_FOUND");
          }
          return result;
        }),
      list: protectedProcedure
        .input(
          z.object({
            identityType: identityTypeSchema.optional(),
            limit: z.coerce.number().int().min(1).max(100).default(25),
            status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          const conditions = [];
          if (input.identityType) {
            conditions.push(
              eq(identityAccounts.identityType, input.identityType)
            );
          }
          if (input.status) {
            conditions.push(eq(identityAccounts.status, input.status));
          }
          return context.db
            .select({
              account: identityAccounts,
              name: user.name,
              username: user.username,
            })
            .from(identityAccounts)
            .innerJoin(user, eq(user.id, identityAccounts.userId))
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(identityAccounts.createdAt))
            .limit(input.limit);
        }),
      resetPassword: protectedProcedure
        .input(accountIdInput)
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return requireIdentityService(context).resetPassword({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
        }),
    },
    firstLogin: {
      complete: authenticatedProcedure.handler(async ({ context }) => {
        if (!context.identity?.mustChangePassword) {
          throw new ORPCError("BAD_REQUEST");
        }
        await requireIdentityService(context).completeFirstLogin(
          context.session?.user.id as string
        );
        return { status: "READY" as const };
      }),
    },
    me: protectedProcedure.handler(({ context }) => context.identity),
    programHeads: {
      assign: protectedProcedure
        .input(
          z.object({
            endsAt: dateSchema.nullable(),
            prodiId: z.string().min(1),
            startsAt: dateSchema,
            userId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return requireIdentityService(context).assignProgramHead({
            ...input,
            assignedBy: context.session?.user.id as string,
          });
        }),
      end: protectedProcedure
        .input(z.object({ endsAt: dateSchema, id: z.string().min(1) }))
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          await requireIdentityService(context).endProgramHead({
            ...input,
            assignedBy: context.session?.user.id as string,
          });
          return { status: "ENDED" as const };
        }),
    },
    roles: {
      assign: protectedProcedure
        .input(z.object({ roleKey: roleKeySchema, userId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          return requireIdentityService(context).assignRole({
            ...input,
            assignedBy: context.session?.user.id as string,
          });
        }),
      list: protectedProcedure.handler(({ context }) => {
        requireRole(context, ["SUPERADMIN"]);
        return context.db
          .select({
            description: roles.description,
            key: roles.key,
            name: roles.name,
          })
          .from(roles)
          .orderBy(roles.key);
      }),
      revoke: protectedProcedure
        .input(z.object({ roleKey: roleKeySchema, userId: z.string().min(1) }))
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          await requireIdentityService(context).revokeRole({
            ...input,
            assignedBy: context.session?.user.id as string,
          });
          return { status: "REVOKED" as const };
        }),
    },
    scopes: {
      assign: protectedProcedure
        .input(
          z.object({
            endsAt: dateSchema.nullable(),
            scopeId: z.string().min(1),
            scopeType: scopeTypeSchema,
            startsAt: dateSchema,
            userId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          return requireIdentityService(context).assignScope(input);
        }),
      list: protectedProcedure.handler(({ context }) => {
        requireRole(context, ["SUPERADMIN"]);
        return context.db
          .select({
            endsAt: userScopes.endsAt,
            id: userScopes.id,
            scopeId: userScopes.scopeId,
            scopeType: userScopes.scopeType,
            startsAt: userScopes.startsAt,
            userId: userScopes.userId,
          })
          .from(userScopes)
          .orderBy(desc(userScopes.startsAt));
      }),
      revoke: protectedProcedure
        .input(z.object({ id: z.string().min(1), userId: z.string().min(1) }))
        .handler(async ({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          await requireIdentityService(context).revokeScope(input);
          return { status: "REVOKED" as const };
        }),
    },
    sessions: {
      list: protectedProcedure.handler(async ({ context }) => {
        const userId = context.session?.user.id as string;
        const currentSessionId = context.session?.session.id;
        const sessions = await context.db
          .select()
          .from(session)
          .where(eq(session.userId, userId))
          .orderBy(desc(session.updatedAt));
        return sessions.map((item) => ({
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          id: item.id,
          ipAddress: maskIpAddress(item.ipAddress),
          isCurrent: item.id === currentSessionId,
          lastActivityAt: item.updatedAt,
          userAgent: item.userAgent,
        }));
      }),
      revoke: protectedProcedure
        .input(z.object({ sessionId: z.string().min(1) }))
        .handler(async ({ context, input }) => {
          await context.db
            .delete(session)
            .where(
              and(
                eq(session.id, input.sessionId),
                eq(session.userId, context.session?.user.id as string)
              )
            );
          return { status: "REVOKED" as const };
        }),
      revokeAll: protectedProcedure.handler(async ({ context }) => {
        await context.db
          .delete(session)
          .where(eq(session.userId, context.session?.user.id as string));
        return { status: "REVOKED" as const };
      }),
      revokeOthers: protectedProcedure.handler(async ({ context }) => {
        const currentSessionId = context.session?.session.id;
        if (currentSessionId) {
          await context.db
            .delete(session)
            .where(
              and(
                eq(session.userId, context.session?.user.id as string),
                ne(session.id, currentSessionId)
              )
            );
        }
        return { status: "REVOKED" as const };
      }),
    },
    status: authenticatedProcedure.handler(({ context }) => ({
      identifier: context.identity?.identifier ?? null,
      mustChangePassword: context.identity?.mustChangePassword ?? false,
      roles: context.identity?.roles ?? [],
      status: context.identity?.status ?? "INACTIVE",
    })),
  },
  masterData: {
    archive: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          id: z.string().min(1),
        })
      )
      .handler(async ({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        await context.masterDataService.archive({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
        return { status: "ARCHIVED" as const };
      }),
    create: protectedProcedure
      .input(
        z.object({
          data: masterDataDataSchema,
          entityType: masterDataEntitySchema,
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.masterDataService.create({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
      }),
    export: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          search: z.string().trim().max(100).optional(),
          status: masterDataStatusSchema.optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.masterDataService.export(input);
      }),
    get: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          id: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.masterDataService.get(input);
      }),
    identifierUsages: {
      list: protectedProcedure
        .input(
          z.object({
            entityId: z.string().min(1),
            entityType: masterDataEntitySchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.db
            .select()
            .from(masterIdentifierUsages)
            .where(
              and(
                eq(masterIdentifierUsages.entityId, input.entityId),
                eq(masterIdentifierUsages.entityType, input.entityType)
              )
            )
            .orderBy(desc(masterIdentifierUsages.createdAt));
        }),
    },
    import: {
      commit: protectedProcedure
        .input(
          z.object({
            jobId: z.string().min(1),
            limit: z.coerce.number().int().min(1).max(100).default(25),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.masterDataService.commitImport({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
        }),
      create: protectedProcedure
        .input(
          z.object({
            checksum: z.string().trim().min(8).max(128),
            content: z.string().min(1).max(10_000_000),
            entityType: masterDataEntitySchema,
            filename: z.string().trim().min(1).max(180),
            templateVersion: z.string().trim().min(1).max(20),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.masterDataService.createImport({
            ...input,
            actorUserId: context.session?.user.id as string,
          });
        }),
      preview: protectedProcedure
        .input(
          z.object({
            jobId: z.string().min(1),
            limit: z.coerce.number().int().min(1).max(100).default(50),
            status: z.enum(["INVALID", "VALID", "WARNING"]).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.masterDataService.previewImport(input);
        }),
      template: protectedProcedure
        .input(z.object({ entityType: masterDataEntitySchema }))
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return {
            headers: templateHeaders(input.entityType),
            templateVersion: MASTER_DATA_TEMPLATE_VERSION,
          };
        }),
    },
    list: protectedProcedure
      .input(
        z.object({
          cursor: z.string().min(1).optional(),
          entityType: masterDataEntitySchema,
          limit: z.coerce.number().int().min(1).max(100).default(25),
          search: z.string().trim().max(100).optional(),
          status: masterDataStatusSchema.optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.masterDataService.list(input);
      }),
    reactivate: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          id: z.string().min(1),
        })
      )
      .handler(async ({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        await context.masterDataService.reactivate({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
        return { status: "ACTIVE" as const };
      }),
    summary: protectedProcedure.handler(({ context }) => {
      requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
      return context.masterDataService.summary();
    }),
    update: protectedProcedure
      .input(
        z.object({
          data: masterDataDataSchema,
          entityType: masterDataEntitySchema,
          id: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.masterDataService.update({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
      }),
  },
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  settings: {
    catalog: protectedProcedure
      .input(
        z.object({
          asOf: dateSchema.optional(),
          category: settingCategorySchema.optional(),
          scopeId: z.string().trim().optional(),
          scopeType: settingScopeTypeSchema.optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
        return context.settingsService.list(input);
      }),
    gradeScales: {
      list: protectedProcedure
        .input(settingsScopeSchema.optional())
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
          return context.settingsService.listGradeScales(input);
        }),
      publish: protectedProcedure
        .input(
          z.object({
            effectiveFrom: dateSchema,
            entries: gradeScaleEntriesSchema,
            name: z.string().trim().min(1).max(100),
            scope: settingsScopeSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          return context.settingsService.publishGradeScale({
            ...input,
            actorUserId: context.session?.user.id as string,
            entries: input.entries as GradeScaleEntry[],
          });
        }),
    },
    publish: protectedProcedure
      .input(
        z.object({
          effectiveFrom: dateSchema,
          expectedVersions: z
            .record(z.string(), z.number().int().min(0))
            .optional(),
          note: z.string().trim().max(500).optional(),
          scope: settingsScopeSchema,
          values: settingValuesSchema,
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN"]);
        return context.settingsService.publish({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
      }),
    rollback: protectedProcedure
      .input(
        z.object({
          effectiveFrom: dateSchema,
          note: z.string().trim().max(500).optional(),
          versionId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN"]);
        return context.settingsService.rollback({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
      }),
    securityPolicy: protectedProcedure.handler(({ context }) =>
      context.settingsService.getSecurityPolicy()
    ),
  },
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

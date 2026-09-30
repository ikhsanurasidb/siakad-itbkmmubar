import { attendanceStatuses } from "@api/attendance";
import type { Context } from "@api/context";
import { curriculumCourseTypes, curriculumStatuses } from "@api/curriculum";
import {
  assertProvisioningPermission,
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
  academicPeriodStatusesList,
  studentAcademicStatuses,
  templateHeaders,
  masterDataEntityTypes,
  masterDataListStatuses,
} from "@api/master-data";
import {
  scheduleChangeRequestStatuses,
  scheduleDraftStatuses,
  scheduleModalities,
} from "@api/scheduling";
import { settingCategories, settingScopeTypes } from "@api/settings";
import type { GradeScaleEntry } from "@api/settings";
import { studyPlanStatuses } from "@api/study-plan";
import type { RouterClient } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { session, user } from "@siakad-itbkmmubar/db/schema/auth";
import {
  identityAccounts,
  roles,
  userScopes,
} from "@siakad-itbkmmubar/db/schema/identity";
import { identifierUsages as masterIdentifierUsages } from "@siakad-itbkmmubar/db/schema/master-data";
import { notifications as notificationTable } from "@siakad-itbkmmubar/db/schema/platform";
import { and, desc, eq, ne, sql } from "drizzle-orm";
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

const requireBulkAcademicIdentityType = (
  identityType: (typeof identityTypes)[number]
): void => {
  if (identityType !== "DOSEN" && identityType !== "MAHASISWA") {
    throw new ORPCError("FORBIDDEN");
  }
};

const toNotificationRecord = (
  notification: typeof notificationTable.$inferSelect
) => ({
  body: notification.body,
  createdAt: notification.createdAt.toISOString(),
  id: notification.id,
  readAt: notification.readAt?.toISOString() ?? null,
  route: notification.route,
  status: notification.status as "READ" | "UNREAD",
  title: notification.title,
  type: notification.type,
});

const accountIdInput = z.object({ accountId: z.string().min(1) });
const currentPasswordSchema = z.string().min(1).max(512);
const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(
    /^(?:\+?[1-9]\d{7,14}|0\d{8,14})$/u,
    "Nomor telepon harus berisi 9–15 digit dan dapat diawali tanda plus."
  );
const masterDataEntitySchema = z.enum(masterDataEntityTypes);
const academicPeriodStatusSchema = z.enum(academicPeriodStatusesList);
const masterDataListStatusSchema = z.enum(masterDataListStatuses);
const studentAcademicStatusSchema = z.enum(studentAcademicStatuses);
const masterDataDataSchema = z.record(z.string(), z.unknown());
const masterDataImportValueSchema = z.union([
  z.string().max(1000),
  z.number().finite(),
  z.null(),
]);
const masterDataImportRowsSchema = z
  .array(z.record(z.string().max(80), masterDataImportValueSchema))
  .min(1)
  .max(10_000);
const settingCategorySchema = z.enum(settingCategories);
const settingScopeTypeSchema = z.enum(settingScopeTypes);
const settingsScopeSchema = z.object({
  scopeId: z.string().trim().default(""),
  scopeType: settingScopeTypeSchema.default("SYSTEM"),
});
const settingValuesSchema = z.record(z.string(), z.unknown());
const curriculumStatusSchema = z.enum(curriculumStatuses);
const curriculumCourseTypeSchema = z.enum(curriculumCourseTypes);
const curriculumCourseInputSchema = z.object({
  courseId: z.string().trim().min(1),
  courseType: curriculumCourseTypeSchema,
  semester: z.number().int().min(1).max(8),
});
const curriculumAssessmentComponentSchema = z.object({
  componentCode: z.string().trim().min(1).max(32),
  label: z.string().trim().min(1).max(80),
  weight: z.number().int().min(0).max(100),
});
const gradeScaleEntriesSchema = z.array(
  z.object({
    gradeCode: z.string().trim().min(1).max(10),
    label: z.string().trim().min(1).max(80),
    maxScore: z.number().finite().min(0).max(100),
    minScore: z.number().finite().min(0).max(100),
    qualityPoints: z.number().finite().min(0).max(4),
  })
);
const studyPlanStatusSchema = z.enum(studyPlanStatuses);
const scheduleDraftStatusSchema = z.enum(scheduleDraftStatuses);
const scheduleModalitySchema = z.enum(scheduleModalities);
const scheduleChangeRequestStatusSchema = z.enum(scheduleChangeRequestStatuses);
const clockTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Gunakan format waktu HH:mm.");
const lmsFileSchema = z.object({
  contentBase64: z.string().min(1).max(40_000_000),
  declaredMime: z.string().trim().max(120).optional(),
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(120),
});
const lmsFilesSchema = z.array(lmsFileSchema).max(5).optional();
const attendanceStatusSchema = z.enum(attendanceStatuses);
const attendanceReviewStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const);

export const appRouter = {
  attendance: {
    decideRequest: protectedProcedure
      .input(
        z.object({
          approve: z.boolean(),
          expectedVersion: z.number().int().min(1),
          reason: z.string().trim().max(500).optional(),
          requestId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "DOSEN",
        ]);
        return context.attendanceService.decideRequest({
          ...input,
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
        });
      }),
    generateAlpa: protectedProcedure
      .input(
        z.object({
          idempotencyKey: z.string().trim().min(16).max(128),
          sessionId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "DOSEN",
        ]);
        return context.attendanceService.generateAlpa({
          ...input,
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
        });
      }),
    list: protectedProcedure
      .input(z.object({ classSectionId: z.string().min(1).optional() }))
      .handler(({ context, input }) => {
        requireRole(context, ["MAHASISWA", "DOSEN"]);
        return context.attendanceService.list({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    reviews: {
      list: protectedProcedure
        .input(z.object({ status: attendanceReviewStatusSchema.optional() }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.attendanceService.listReviews({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    startCapture: protectedProcedure
      .input(z.object({ meetingId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, ["MAHASISWA", "DOSEN"]);
        return context.attendanceService.startCapture({
          ...input,
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
        });
      }),
    submit: protectedProcedure
      .input(
        z.object({
          accuracyMeters: z.number().finite().nonnegative().optional(),
          captureAttemptId: z.string().min(1),
          contentBase64: z.string().min(1).max(20_000_000),
          declaredMime: z.string().trim().min(1).max(120),
          filename: z.string().trim().min(1).max(180).optional(),
          idempotencyKey: z.string().trim().min(16).max(128),
          latitude: z.number().finite().optional(),
          longitude: z.number().finite().optional(),
          note: z.string().trim().max(1000).optional(),
          status: attendanceStatusSchema,
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["MAHASISWA", "DOSEN"]);
        return context.attendanceService.submit({
          ...input,
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
        });
      }),
  },
  curriculum: {
    activate: protectedProcedure
      .input(z.object({ curriculumId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "KAPRODI"]);
        return context.curriculumService.activate({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    archive: protectedProcedure
      .input(z.object({ curriculumId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "KAPRODI"]);
        return context.curriculumService.archive({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    assessments: {
      replace: protectedProcedure
        .input(
          z.object({
            curriculumId: z.string().min(1),
            overrides: z.array(
              z.object({
                components: z.array(curriculumAssessmentComponentSchema),
                curriculumCourseId: z.string().min(1),
              })
            ),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "KAPRODI"]);
          return context.curriculumService.replaceAssessments({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    create: protectedProcedure
      .input(
        z.object({
          cohortId: z.string().min(1),
          name: z.string().trim().min(3).max(160),
          studyProgramId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "KAPRODI"]);
        return context.curriculumService.create({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    detail: protectedProcedure
      .input(z.object({ curriculumId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
        return context.curriculumService.get({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    documents: {
      upload: protectedProcedure
        .input(
          z.object({
            contentBase64: z.string().min(1).max(20_000_000),
            curriculumId: z.string().min(1),
            declaredMime: z.string().trim().max(120).optional(),
            documentType: z.string().trim().min(1).max(40).optional(),
            filename: z.string().trim().min(1).max(180),
            mimeType: z.string().trim().min(1).max(120),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "KAPRODI"]);
          return context.curriculumService.uploadDocument({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    list: protectedProcedure
      .input(
        z.object({
          prodiId: z.string().min(1).optional(),
          status: curriculumStatusSchema.optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
        return context.curriculumService.list({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    structure: {
      importFromCatalog: protectedProcedure
        .input(z.object({ curriculumId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "KAPRODI"]);
          return context.curriculumService.importFromCatalog({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      replace: protectedProcedure
        .input(
          z.object({
            courses: z.array(curriculumCourseInputSchema).max(200),
            curriculumId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "KAPRODI"]);
          return context.curriculumService.replaceStructure({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
  },
  grades: {
    classes: {
      detail: protectedProcedure
        .input(z.object({ classSectionId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.gradesService.classDetail({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      list: protectedProcedure
        .input(z.object({ academicPeriodId: z.string().min(1).optional() }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.gradesService.listClasses({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    lock: protectedProcedure
      .input(
        z.object({
          classSectionId: z.string().min(1),
          expectedVersion: z.number().int().min(0),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["DOSEN"]);
        return context.gradesService.lock({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    publish: protectedProcedure
      .input(
        z.object({
          classSectionId: z.string().min(1),
          expectedVersion: z.number().int().min(0),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.gradesService.publish({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    publishPeriod: protectedProcedure
      .input(
        z.object({
          academicPeriodId: z.string().min(1),
          idempotencyKey: z.string().trim().min(1).max(160).optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.gradesService.publishPeriod({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    reopen: protectedProcedure
      .input(
        z.object({
          classSectionId: z.string().min(1),
          expectedVersion: z.number().int().min(0),
          reason: z.string().trim().min(10).max(500),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.gradesService.reopen({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    saveScores: protectedProcedure
      .input(
        z.object({
          classSectionId: z.string().min(1),
          scores: z
            .array(
              z.object({
                componentId: z.string().min(1),
                expectedVersion: z.number().int().min(0),
                score: z.number().finite().min(0).max(100),
                studentId: z.string().min(1),
              })
            )
            .max(1000),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["DOSEN"]);
        return context.gradesService.saveScores({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    student: {
      khs: protectedProcedure
        .input(
          z.object({
            academicPeriodId: z.string().min(1).optional(),
            studentId: z.string().min(1).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "MAHASISWA",
          ]);
          return context.gradesService.studentKhs({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      transcript: protectedProcedure
        .input(z.object({ studentId: z.string().min(1).optional() }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "MAHASISWA",
          ]);
          return context.gradesService.studentTranscript({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    submit: protectedProcedure
      .input(
        z.object({
          classSectionId: z.string().min(1),
          expectedVersion: z.number().int().min(0),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["DOSEN"]);
        return context.gradesService.submit({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
  },
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
          requireBulkAcademicIdentityType(input.identityType);
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
          requireBulkAcademicIdentityType(input.identityType);
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
          try {
            assertProvisioningPermission(actorRoles, input.identityType);
          } catch {
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
              email: user.email,
              name: user.name,
              phone: identityAccounts.phone,
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
              email: user.email,
              name: user.name,
              phone: identityAccounts.phone,
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
            actorIdentityType: context.identity?.identityType ?? null,
            actorUserId: context.session?.user.id as string,
          });
        }),
    },
    admins: {
      create: protectedProcedure
        .input(
          z.object({
            email: z.email().optional(),
            name: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN"]);
          return requireIdentityService(context).createAccount({
            ...input,
            actorUserId: context.session?.user.id as string,
            identityType: "ADMIN_AKADEMIK",
            roleKey: "ADMIN_AKADEMIK",
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
    profile: {
      confirmEmailChange: authenticatedProcedure
        .input(
          z.object({ verificationToken: z.string().trim().min(16).max(256) })
        )
        .handler(({ context, input }) =>
          requireIdentityService(context).confirmEmailChange(input)
        ),
      get: authenticatedProcedure.handler(({ context }) =>
        requireIdentityService(context).getContact({
          userId: context.session?.user.id as string,
        })
      ),
      requestEmailChange: authenticatedProcedure
        .input(
          z.object({
            currentPassword: currentPasswordSchema,
            newEmail: z.email(),
          })
        )
        .handler(({ context, input }) =>
          requireIdentityService(context).requestEmailChange({
            ...input,
            userId: context.session?.user.id as string,
          })
        ),
      updatePhone: authenticatedProcedure
        .input(
          z.object({
            currentPassword: currentPasswordSchema,
            phone: phoneSchema.nullable(),
          })
        )
        .handler(({ context, input }) =>
          requireIdentityService(context).updatePhone({
            ...input,
            userId: context.session?.user.id as string,
          })
        ),
    },
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
      list: protectedProcedure.handler(({ context }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return requireIdentityService(context).listProgramHeads();
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
      activeRole: context.identity?.activeRole ?? null,
      availableRoles: context.identity?.availableRoles ?? [],
      identifier: context.identity?.identifier ?? null,
      mustChangePassword: context.identity?.mustChangePassword ?? false,
      roles: context.identity?.roles ?? [],
      status: context.identity?.status ?? "INACTIVE",
    })),
  },
  lms: {
    assignments: {
      create: protectedProcedure
        .input(
          z.object({
            allowResubmit: z.boolean().optional(),
            body: z.string().max(20_000).optional(),
            classMeetingId: z.string().min(1).optional(),
            classSectionId: z.string().min(1),
            dueAt: dateSchema,
            files: lmsFilesSchema,
            title: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.createAssignment({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      listSubmissions: protectedProcedure
        .input(z.object({ assignmentId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.listSubmissions({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      publish: protectedProcedure
        .input(
          z.object({
            assignmentId: z.string().min(1),
            expectedVersion: z.number().int().min(0),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.publishAssignment({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      submit: protectedProcedure
        .input(
          z.object({
            assignmentId: z.string().min(1),
            body: z.string().max(20_000).optional(),
            files: lmsFilesSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["MAHASISWA"]);
          return context.lmsService.submitAssignment({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      update: protectedProcedure
        .input(
          z.object({
            allowResubmit: z.boolean().optional(),
            assignmentId: z.string().min(1),
            body: z.string().max(20_000).optional(),
            dueAt: dateSchema,
            expectedVersion: z.number().int().min(0),
            title: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.updateAssignment({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    detail: protectedProcedure
      .input(
        z.object({
          classMeetingId: z.string().min(1).optional(),
          classSectionId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "DOSEN",
          "MAHASISWA",
        ]);
        return context.lmsService.detail({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    files: {
      download: protectedProcedure
        .input(z.object({ fileObjectId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
            "MAHASISWA",
          ]);
          return context.lmsService.downloadFile({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    forum: {
      close: protectedProcedure
        .input(z.object({ threadId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.closeThread({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      createPost: protectedProcedure
        .input(
          z.object({
            body: z.string().trim().min(1).max(20_000),
            threadId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN", "MAHASISWA"]);
          return context.lmsService.createPost({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      createThread: protectedProcedure
        .input(
          z.object({
            body: z.string().trim().min(1).max(20_000),
            classMeetingId: z.string().min(1).optional(),
            classSectionId: z.string().min(1),
            title: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN", "MAHASISWA"]);
          return context.lmsService.createThread({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      deletePost: protectedProcedure
        .input(z.object({ postId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN", "MAHASISWA"]);
          return context.lmsService.deletePost({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      editPost: protectedProcedure
        .input(
          z.object({
            body: z.string().trim().min(1).max(20_000),
            postId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN", "MAHASISWA"]);
          return context.lmsService.editPost({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      list: protectedProcedure
        .input(
          z.object({
            classMeetingId: z.string().min(1).optional(),
            classSectionId: z.string().min(1),
            cursor: z.string().optional(),
            limit: z.number().int().min(1).max(50).default(20),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
            "MAHASISWA",
          ]);
          return context.lmsService.listThreads({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    materials: {
      create: protectedProcedure
        .input(
          z.object({
            body: z.string().max(20_000).optional(),
            classMeetingId: z.string().min(1).optional(),
            classSectionId: z.string().min(1),
            files: lmsFilesSchema,
            title: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.createMaterial({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      publish: protectedProcedure
        .input(
          z.object({
            expectedVersion: z.number().int().min(0),
            materialId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.publishMaterial({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      update: protectedProcedure
        .input(
          z.object({
            body: z.string().max(20_000).optional(),
            expectedVersion: z.number().int().min(0),
            materialId: z.string().min(1),
            title: z.string().trim().min(1).max(160),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.lmsService.updateMaterial({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
  },
  masterData: {
    archive: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          expectedVersion: z.number().int().min(1),
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
    changeAcademicPeriodStatus: protectedProcedure
      .input(
        z.object({
          expectedVersion: z.number().int().min(1),
          id: z.string().min(1),
          status: academicPeriodStatusSchema,
        })
      )
      .handler(async ({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        await context.masterDataService.changeAcademicPeriodStatus({
          ...input,
          actorUserId: context.session?.user.id as string,
        });
        return { status: input.status };
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
          provisionAccount: true,
        });
      }),
    export: protectedProcedure
      .input(
        z.object({
          entityType: masterDataEntitySchema,
          search: z.string().trim().max(100).optional(),
          status: masterDataListStatusSchema.optional(),
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
            entityType: masterDataEntitySchema,
            filename: z
              .string()
              .trim()
              .min(1)
              .max(180)
              .regex(/\.xlsx$/iu, "File impor harus berformat .xlsx."),
            rows: masterDataImportRowsSchema,
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
          academicStatus: studentAcademicStatusSchema.optional(),
          cursor: z.string().min(1).optional(),
          entityType: masterDataEntitySchema,
          limit: z.coerce.number().int().min(1).max(100).default(25),
          search: z.string().trim().max(100).optional(),
          status: masterDataListStatusSchema.optional(),
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
          expectedVersion: z.number().int().min(1),
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
          expectedVersion: z.number().int().min(1),
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
  notifications: {
    list: protectedProcedure
      .input(
        z.object({
          limit: z.coerce.number().int().min(1).max(25).default(8),
        })
      )
      .handler(async ({ context, input }) => {
        const userId = context.session?.user.id as string;
        const [rows, unreadResult] = await Promise.all([
          context.db
            .select()
            .from(notificationTable)
            .where(eq(notificationTable.userId, userId))
            .orderBy(
              desc(notificationTable.createdAt),
              desc(notificationTable.id)
            )
            .limit(input.limit),
          context.db
            .select({ count: sql<number>`count(*)` })
            .from(notificationTable)
            .where(
              and(
                eq(notificationTable.userId, userId),
                eq(notificationTable.status, "UNREAD")
              )
            ),
        ]);

        return {
          items: rows.map(toNotificationRecord),
          unreadCount: Number(unreadResult[0]?.count ?? 0),
        };
      }),
    markAllRead: protectedProcedure.handler(async ({ context }) => {
      await context.db
        .update(notificationTable)
        .set({
          readAt: new Date(),
          status: "READ",
        })
        .where(
          and(
            eq(notificationTable.userId, context.session?.user.id as string),
            eq(notificationTable.status, "UNREAD")
          )
        );

      return { status: "READ" as const };
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.string().min(1) }))
      .handler(async ({ context, input }) => {
        await context.db
          .update(notificationTable)
          .set({
            readAt: new Date(),
            status: "READ",
          })
          .where(
            and(
              eq(notificationTable.id, input.notificationId),
              eq(notificationTable.userId, context.session?.user.id as string),
              eq(notificationTable.status, "UNREAD")
            )
          );

        return { status: "READ" as const };
      }),
  },
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  scheduling: {
    changeRequests: {
      decide: protectedProcedure
        .input(
          z.object({
            approve: z.boolean(),
            reason: z.string().trim().max(500).optional(),
            requestId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.decideOfflineChange({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      list: protectedProcedure
        .input(
          z.object({ status: scheduleChangeRequestStatusSchema.optional() })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
          ]);
          return context.schedulingService.listChangeRequests({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      request: protectedProcedure
        .input(
          z.object({
            endAt: dateSchema,
            meetingId: z.string().min(1),
            reason: z.string().trim().min(10).max(500),
            roomId: z.string().min(1),
            startAt: dateSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN"]);
          return context.schedulingService.requestOfflineChange({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    drafts: {
      create: protectedProcedure
        .input(
          z.object({
            academicPeriodId: z.string().min(1),
            studyProgramId: z.string().min(1),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.createDraft({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      decide: protectedProcedure
        .input(
          z.object({
            approve: z.boolean(),
            draftId: z.string().min(1),
            expectedVersion: z.number().int().min(0),
            reason: z.string().trim().max(500).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["KAPRODI"]);
          return context.schedulingService.decideDraft({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      detail: protectedProcedure
        .input(z.object({ draftId: z.string().min(1) }))
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
          return context.schedulingService.detailDraft({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      list: protectedProcedure
        .input(z.object({ status: scheduleDraftStatusSchema.optional() }))
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI"]);
          return context.schedulingService.listDrafts({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      publish: protectedProcedure
        .input(
          z.object({
            draftId: z.string().min(1),
            expectedVersion: z.number().int().min(0),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.publishDraft({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      submit: protectedProcedure
        .input(
          z.object({
            draftId: z.string().min(1),
            expectedVersion: z.number().int().min(0),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.submitDraft({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      upsertSlot: protectedProcedure
        .input(
          z.object({
            classSectionId: z.string().min(1),
            draftId: z.string().min(1),
            endAt: dateSchema,
            instructions: z.string().trim().max(1000).optional(),
            modality: scheduleModalitySchema,
            onlineUrl: z.url().max(2000).optional(),
            roomId: z.string().min(1).optional(),
            startAt: dateSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.upsertSlot({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    mapping: {
      generate: protectedProcedure
        .input(
          z.object({
            academicPeriodId: z.string().min(1),
            classCapacity: z.number().int().min(1).max(500).default(30),
            idempotencyKey: z.string().trim().min(1).max(160).optional(),
            studyProgramId: z.string().min(1).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.generateMapping({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    meetings: {
      list: protectedProcedure.handler(({ context }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "DOSEN",
          "MAHASISWA",
        ]);
        return context.schedulingService.listMeetings({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
        });
      }),
      setOnline: protectedProcedure
        .input(
          z.object({
            instructions: z.string().trim().max(1000).optional(),
            meetingId: z.string().min(1),
            onlineUrl: z.url().max(2000).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["DOSEN"]);
          return context.schedulingService.updateMeetingOnline({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    nationalHolidays: {
      list: protectedProcedure
        .input(z.object({ year: z.number().int().min(2000).max(2100) }))
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
            "MAHASISWA",
          ]);
          return context.schedulingService.listNationalHolidays({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    schedule: {
      create: protectedProcedure
        .input(
          z.object({
            classSectionId: z.string().min(1),
            dayOfWeek: z.number().int().min(1).max(7),
            endTime: clockTimeSchema,
            instructions: z.string().trim().max(1000).optional(),
            lecturerIds: z
              .array(z.string().min(1))
              .min(1)
              .max(2)
              .refine(
                (ids) => new Set(ids).size === ids.length,
                "Pilih dosen yang berbeda."
              ),
            modality: scheduleModalitySchema,
            roomId: z.string().min(1).optional(),
            startTime: clockTimeSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.createSchedule({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
      preview: protectedProcedure
        .input(
          z.object({
            classSectionId: z.string().min(1),
            dayOfWeek: z.number().int().min(1).max(7),
            endTime: clockTimeSchema,
            startTime: clockTimeSchema,
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
          return context.schedulingService.previewSchedule({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
    sections: {
      list: protectedProcedure
        .input(
          z.object({
            academicPeriodId: z.string().min(1).optional(),
            studyProgramId: z.string().min(1).optional(),
          })
        )
        .handler(({ context, input }) => {
          requireRole(context, [
            "SUPERADMIN",
            "ADMIN_AKADEMIK",
            "KAPRODI",
            "DOSEN",
            "MAHASISWA",
          ]);
          return context.schedulingService.listSections({
            actorRoles: context.identity?.roles ?? [],
            actorUserId: context.session?.user.id as string,
            ...input,
          });
        }),
    },
  },
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
  studyPlan: {
    detail: protectedProcedure
      .input(z.object({ studyPlanId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "MAHASISWA",
        ]);
        return context.studyPlanService.detail({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    finalize: protectedProcedure
      .input(z.object({ studyPlanId: z.string().min(1) }))
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.studyPlanService.finalize({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    generate: protectedProcedure
      .input(
        z.object({
          academicPeriodId: z.string().min(1),
          cohortId: z.string().min(1).optional(),
          idempotencyKey: z.string().trim().min(1).max(160).optional(),
          prodiId: z.string().min(1).optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.studyPlanService.generate({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    list: protectedProcedure
      .input(
        z.object({
          academicPeriodId: z.string().min(1).optional(),
          prodiId: z.string().min(1).optional(),
          status: studyPlanStatusSchema.optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, [
          "SUPERADMIN",
          "ADMIN_AKADEMIK",
          "KAPRODI",
          "MAHASISWA",
        ]);
        return context.studyPlanService.list({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    listSemesterTrackers: protectedProcedure
      .input(
        z.object({
          academicPeriodId: z.string().min(1),
          cohortId: z.string().min(1).optional(),
          includeInactive: z.boolean().optional(),
          prodiId: z.string().min(1).optional(),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.studyPlanService.listSemesterTrackers({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    reopen: protectedProcedure
      .input(
        z.object({
          reason: z.string().trim().min(10).max(500),
          studyPlanId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.studyPlanService.reopen({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
    updateSemesterTracker: protectedProcedure
      .input(
        z.object({
          academicPeriodId: z.string().min(1),
          semesterNumber: z.number().int().min(1).max(8),
          studentId: z.string().min(1),
        })
      )
      .handler(({ context, input }) => {
        requireRole(context, ["SUPERADMIN", "ADMIN_AKADEMIK"]);
        return context.studyPlanService.updateSemesterTracker({
          actorRoles: context.identity?.roles ?? [],
          actorUserId: context.session?.user.id as string,
          ...input,
        });
      }),
  },
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

import type {
  CurriculumAssessmentComponent,
  CurriculumListItem,
  CurriculumRecord,
  CurriculumStatus,
} from "@api/curriculum";
import type { IdentityType, RoleKey } from "@api/identity";
import type { MasterDataEntityType, MasterDataStatus } from "@api/master-data";
import type {
  ClassMappingResult,
  ClassMeetingRecord,
  ScheduleChangeRequestRecord,
  ScheduleDraftRecord,
  ScheduleModality,
  ScheduleSectionRecord,
} from "@api/scheduling";
import type {
  AttendancePolicy,
  BatchPolicy,
  FilePolicy,
  GradeScaleEntry,
  GradingPolicy,
  SchedulingPolicy,
  SecurityPolicy,
  SettingCategory,
  SettingKey,
  SettingScopeType,
} from "@api/settings";
import type {
  StudyPlanGenerationResult,
  StudyPlanListItem,
  StudyPlanRecord,
  StudyPlanStatus,
} from "@api/study-plan";
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
  activeRole: RoleKey | null;
  availableRoles: readonly RoleKey[];
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

export interface MasterDataService {
  archive: (input: {
    actorUserId: string;
    entityType: MasterDataEntityType;
    id: string;
  }) => Promise<void>;
  create: (input: {
    actorUserId: string;
    data: Readonly<Record<string, unknown>>;
    entityType: MasterDataEntityType;
  }) => Promise<Record<string, unknown>>;
  createImport: (input: {
    actorUserId: string;
    checksum: string;
    content: string;
    entityType: MasterDataEntityType;
    filename: string;
    templateVersion: string;
  }) => Promise<{
    id: string;
    status: string;
    summary: Record<string, number>;
  }>;
  export: (input: {
    entityType: MasterDataEntityType;
    search?: string;
    status?: MasterDataStatus;
  }) => Promise<readonly Record<string, unknown>[]>;
  get: (input: {
    entityType: MasterDataEntityType;
    id: string;
  }) => Promise<Record<string, unknown>>;
  list: (input: {
    cursor?: string;
    entityType: MasterDataEntityType;
    limit: number;
    search?: string;
    status?: MasterDataStatus;
  }) => Promise<{
    data: readonly Record<string, unknown>[];
    nextCursor: string | null;
  }>;
  summary: () => Promise<{
    entities: readonly {
      activeCount: number;
      archivedCount: number;
      entityType: MasterDataEntityType;
      totalCount: number;
    }[];
    generatedAt: string;
    imports: {
      attentionCount: number;
      completedCount: number;
      inProgressCount: number;
      recent: readonly {
        createdAt: string;
        entityType: MasterDataEntityType;
        filename: string;
        id: string;
        invalidCount: number;
        status: string;
        totalRows: number;
        validCount: number;
        warningCount: number;
      }[];
    };
    totals: {
      activeCount: number;
      archivedCount: number;
      totalCount: number;
    };
  }>;
  previewImport: (input: {
    jobId: string;
    limit: number;
    status?: "INVALID" | "VALID" | "WARNING";
  }) => Promise<{
    data: readonly Record<string, unknown>[];
    job: Record<string, unknown>;
  }>;
  reactivate: (input: {
    actorUserId: string;
    entityType: MasterDataEntityType;
    id: string;
  }) => Promise<void>;
  commitImport: (input: {
    actorUserId: string;
    jobId: string;
    limit: number;
  }) => Promise<Record<string, unknown>>;
  update: (input: {
    actorUserId: string;
    data: Readonly<Record<string, unknown>>;
    entityType: MasterDataEntityType;
    id: string;
  }) => Promise<Record<string, unknown>>;
}

export interface CurriculumService {
  activate: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
  }) => Promise<{ status: "ACTIVE" }>;
  archive: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
  }) => Promise<void>;
  create: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    cohortId: string;
    name: string;
    studyProgramId: string;
  }) => Promise<{ id: string }>;
  downloadDocument: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
  }) => Promise<{
    body: ReadableStream;
    contentType: string;
    filename: string;
  }>;
  get: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
  }) => Promise<CurriculumRecord>;
  list: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    prodiId?: string;
    status?: CurriculumStatus;
  }) => Promise<readonly CurriculumListItem[]>;
  replaceAssessments: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
    overrides: readonly {
      components: readonly CurriculumAssessmentComponent[];
      curriculumCourseId: string;
    }[];
  }) => Promise<void>;
  replaceStructure: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    courses: readonly {
      courseId: string;
      courseType: "ELECTIVE" | "REQUIRED";
      semester: number;
    }[];
    curriculumId: string;
  }) => Promise<void>;
  uploadDocument: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    contentBase64: string;
    curriculumId: string;
    declaredMime?: string;
    documentType?: string;
    filename: string;
    mimeType: string;
  }) => Promise<{
    documentId: string;
    fileObjectId: string;
  }>;
}

export interface StudyPlanService {
  detail: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studyPlanId: string;
  }) => Promise<StudyPlanRecord>;
  finalize: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studyPlanId: string;
  }) => Promise<{ status: "FINAL" }>;
  generate: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    cohortId?: string;
    idempotencyKey?: string;
    prodiId?: string;
  }) => Promise<StudyPlanGenerationResult>;
  list: (input: {
    academicPeriodId?: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    prodiId?: string;
    status?: StudyPlanStatus;
  }) => Promise<readonly StudyPlanListItem[]>;
  reopen: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    reason: string;
    studyPlanId: string;
  }) => Promise<{ status: "DRAFT" }>;
}

export interface SchedulingService {
  createDraft: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studyProgramId: string;
  }) => Promise<ScheduleDraftRecord>;
  decideDraft: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    approve: boolean;
    draftId: string;
    expectedVersion: number;
    reason?: string;
  }) => Promise<{ status: "APPROVED" | "REJECTED" }>;
  decideOfflineChange: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    approve: boolean;
    reason?: string;
    requestId: string;
  }) => Promise<{ status: "APPROVED" | "REJECTED" }>;
  detailDraft: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    draftId: string;
  }) => Promise<ScheduleDraftRecord>;
  generateMapping: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classCapacity: number;
    idempotencyKey?: string;
    studyProgramId?: string;
  }) => Promise<ClassMappingResult>;
  listChangeRequests: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    status?: "PENDING" | "APPROVED" | "REJECTED";
  }) => Promise<readonly ScheduleChangeRequestRecord[]>;
  listDrafts: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PUBLISHED";
  }) => Promise<readonly ScheduleDraftRecord[]>;
  listMeetings: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
  }) => Promise<readonly ClassMeetingRecord[]>;
  listSections: (input: {
    academicPeriodId?: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studyProgramId?: string;
  }) => Promise<readonly ScheduleSectionRecord[]>;
  publishDraft: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    draftId: string;
    expectedVersion: number;
  }) => Promise<{ status: "PUBLISHED" }>;
  requestOfflineChange: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    endAt: Date;
    meetingId: string;
    reason: string;
    roomId: string;
    startAt: Date;
  }) => Promise<{ requestId: string; status: "PENDING" }>;
  submitDraft: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    draftId: string;
    expectedVersion: number;
  }) => Promise<{ status: "SUBMITTED" }>;
  updateMeetingOnline: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    instructions?: string;
    meetingId: string;
    onlineUrl?: string;
  }) => Promise<{ status: "ONLINE" }>;
  upsertSlot: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    draftId: string;
    endAt: Date;
    instructions?: string;
    modality: ScheduleModality;
    onlineUrl?: string;
    roomId?: string;
    startAt: Date;
  }) => Promise<{ slotId: string }>;
}

export interface SettingsScope {
  scopeId: string;
  scopeType: SettingScopeType;
}

export interface SettingsCatalogItem {
  category: SettingCategory;
  defaultValue: unknown;
  description: string;
  effectiveFrom: string | null;
  inherited: boolean;
  key: SettingKey;
  label: string;
  maxValue: number | null;
  minValue: number | null;
  value: unknown;
  valueType: string;
  version: number;
  versionId: string | null;
}

export interface SettingsService {
  getAttendancePolicy: (scope?: SettingsScope) => Promise<AttendancePolicy>;
  getBatchPolicy: (scope?: SettingsScope) => Promise<BatchPolicy>;
  getFilePolicy: (
    category: string,
    scope?: SettingsScope
  ) => Promise<FilePolicy>;
  getGradingPolicy: (
    scope?: SettingsScope,
    asOf?: Date
  ) => Promise<GradingPolicy>;
  getSchedulingPolicy: (scope?: SettingsScope) => Promise<SchedulingPolicy>;
  getSecurityPolicy: (scope?: SettingsScope) => Promise<SecurityPolicy>;
  list: (input: {
    asOf?: Date;
    category?: SettingCategory;
    scopeId?: string;
    scopeType?: SettingScopeType;
  }) => Promise<{
    asOf: string;
    items: readonly SettingsCatalogItem[];
    scope: SettingsScope;
  }>;
  listGradeScales: (input?: {
    scopeId?: string;
    scopeType?: SettingScopeType;
  }) => Promise<
    readonly {
      effectiveFrom: string;
      entries: readonly GradeScaleEntry[];
      id: string;
      name: string;
      scopeId: string;
      scopeType: SettingScopeType;
      version: number;
    }[]
  >;
  publish: (input: {
    actorUserId: string;
    effectiveFrom: Date;
    expectedVersions?: Readonly<Partial<Record<SettingKey, number>>>;
    note?: string;
    scope: SettingsScope;
    values: Readonly<Partial<Record<SettingKey, unknown>>>;
  }) => Promise<{ effectiveFrom: string; versionIds: readonly string[] }>;
  publishGradeScale: (input: {
    actorUserId: string;
    effectiveFrom: Date;
    entries: readonly GradeScaleEntry[];
    name: string;
    scope: SettingsScope;
  }) => Promise<{ id: string; version: number }>;
  rollback: (input: {
    actorUserId: string;
    effectiveFrom: Date;
    note?: string;
    versionId: string;
  }) => Promise<{ effectiveFrom: string; versionIds: readonly string[] }>;
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
  curriculumService: CurriculumService;
  logger: ServerLogger;
  request: RequestMetadata;
  identity: IdentityAccess | null;
  identityService: IdentityService;
  masterDataService: MasterDataService;
  settingsService: SettingsService;
  schedulingService: SchedulingService;
  session: Session | null;
  studyPlanService: StudyPlanService;
}

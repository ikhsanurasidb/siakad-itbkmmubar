import type {
  AttendanceCaptureAttemptRecord,
  AttendanceMeetingRecord,
  AttendanceRecordResult,
  AttendanceReviewRecord,
  AttendanceStatus,
} from "@api/attendance";
import type {
  CurriculumAssessmentComponent,
  CurriculumListItem,
  CurriculumRecord,
  CurriculumStatus,
} from "@api/curriculum";
import type { GradeStatus } from "@api/grades";
import type {
  IdentityContactRecord,
  IdentityType,
  ProgramHeadRecord,
  RoleKey,
} from "@api/identity";
import type {
  LmsAssignmentRecord,
  LmsActor,
  LmsClassroomRecord,
  LmsFileInput,
  LmsForumThreadRecord,
  LmsMaterialRecord,
  LmsSubmissionRecord,
} from "@api/lms";
import type {
  MasterDataEntityType,
  MasterDataImportRow,
  MasterDataListStatus,
  AcademicPeriodStatus,
} from "@api/master-data";
import type {
  ClassMappingResult,
  ClassMeetingRecord,
  ScheduleChangeRequestRecord,
  ScheduleCreationResult,
  ScheduleDraftRecord,
  ScheduleModality,
  SchedulePreviewResult,
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
  StudentSemesterTrackerRecord,
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
  confirmEmailChange: (input: {
    verificationToken: string;
  }) => Promise<{ email: string }>;
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
  getContact: (input: { userId: string }) => Promise<IdentityContactRecord>;
  listProgramHeads: () => Promise<readonly ProgramHeadRecord[]>;
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
    actorIdentityType: IdentityType | null;
  }) => Promise<{ temporaryPassword: string }>;
  requestEmailChange: (input: {
    currentPassword: string;
    newEmail: string;
    userId: string;
  }) => Promise<{
    email: string;
    expiresAt: Date;
    status: "PENDING_VERIFICATION";
  }>;
  revokeRole: (input: {
    assignedBy: string;
    roleKey: RoleKey;
    userId: string;
  }) => Promise<void>;
  revokeScope: (input: { id: string; userId: string }) => Promise<void>;
  updatePhone: (input: {
    currentPassword: string;
    phone: string | null;
    userId: string;
  }) => Promise<{ phone: string | null }>;
}

export interface MasterDataCreateResult {
  [key: string]: unknown;
  credential?: {
    identifier: string;
    temporaryPassword: string;
  };
}

export interface MasterDataService {
  archive: (input: {
    actorUserId: string;
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => Promise<void>;
  create: (input: {
    actorUserId: string;
    data: Readonly<Record<string, unknown>>;
    entityType: MasterDataEntityType;
    provisionAccount?: boolean;
  }) => Promise<MasterDataCreateResult>;
  createImport: (input: {
    actorUserId: string;
    checksum: string;
    entityType: MasterDataEntityType;
    filename: string;
    rows: readonly MasterDataImportRow[];
    templateVersion: string;
  }) => Promise<{
    id: string;
    status: string;
    summary: Record<string, number>;
  }>;
  export: (input: {
    entityType: MasterDataEntityType;
    search?: string;
    status?: MasterDataListStatus;
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
    status?: MasterDataListStatus;
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
    expectedVersion: number;
    id: string;
  }) => Promise<void>;
  changeAcademicPeriodStatus: (input: {
    actorUserId: string;
    expectedVersion: number;
    id: string;
    status: AcademicPeriodStatus;
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
    expectedVersion: number;
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
  importFromCatalog: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    curriculumId: string;
  }) => Promise<{
    importedCount: number;
    skippedExistingCount: number;
    skippedWithoutDefaultSemesterCount: number;
  }>;
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
  listSemesterTrackers: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    cohortId?: string;
    prodiId?: string;
  }) => Promise<readonly StudentSemesterTrackerRecord[]>;
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
  updateSemesterTracker: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    semesterNumber: number;
    studentId: string;
  }) => Promise<StudentSemesterTrackerRecord>;
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
  createSchedule: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    dayOfWeek: number;
    endTime: string;
    instructions?: string;
    lecturerIds: readonly string[];
    modality: ScheduleModality;
    roomId?: string;
    startTime: string;
  }) => Promise<ScheduleCreationResult>;
  previewSchedule: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    dayOfWeek: number;
    endTime: string;
    startTime: string;
  }) => Promise<SchedulePreviewResult>;
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

export interface AttendanceService {
  decideRequest: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    approve: boolean;
    reason?: string;
    requestId: string;
    expectedVersion: number;
  }) => Promise<{ status: "APPROVED" | "REJECTED" }>;
  downloadEvidence: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    evidenceId: string;
  }) => Promise<{
    body: ReadableStream;
    contentType: string;
  }>;
  generateAlpa: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    idempotencyKey: string;
    sessionId: string;
  }) => Promise<{ createdCount: number; jobId: string; status: string }>;
  list: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId?: string;
  }) => Promise<readonly AttendanceMeetingRecord[]>;
  listReviews: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    status?: "PENDING" | "APPROVED" | "REJECTED";
  }) => Promise<readonly AttendanceReviewRecord[]>;
  startCapture: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    meetingId: string;
  }) => Promise<AttendanceCaptureAttemptRecord>;
  submit: (input: {
    accuracyMeters?: number;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    captureAttemptId: string;
    contentBase64: string;
    declaredMime: string;
    filename?: string;
    idempotencyKey: string;
    latitude?: number;
    longitude?: number;
    note?: string;
    status: AttendanceStatus;
  }) => Promise<AttendanceRecordResult>;
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

export interface LmsService {
  closeThread: (input: LmsActor & { threadId: string }) => Promise<void>;
  createAssignment: (
    input: LmsActor & {
      allowResubmit?: boolean;
      body?: string;
      classMeetingId?: string;
      classSectionId: string;
      dueAt: Date;
      files?: readonly LmsFileInput[];
      title: string;
    }
  ) => Promise<LmsAssignmentRecord>;
  createMaterial: (
    input: LmsActor & {
      body?: string;
      classMeetingId?: string;
      classSectionId: string;
      files?: readonly LmsFileInput[];
      title: string;
    }
  ) => Promise<LmsMaterialRecord>;
  createPost: (
    input: LmsActor & { body: string; threadId: string }
  ) => Promise<LmsForumThreadRecord>;
  createThread: (
    input: LmsActor & {
      body: string;
      classMeetingId?: string;
      classSectionId: string;
      title: string;
    }
  ) => Promise<LmsForumThreadRecord>;
  deletePost: (input: LmsActor & { postId: string }) => Promise<void>;
  detail: (
    input: LmsActor & { classMeetingId?: string; classSectionId: string }
  ) => Promise<LmsClassroomRecord>;
  downloadFile: (input: LmsActor & { fileObjectId: string }) => Promise<{
    body: ReadableStream;
    contentType: string;
    filename: string;
  }>;
  editPost: (
    input: LmsActor & { body: string; postId: string }
  ) => Promise<void>;
  listThreads: (
    input: LmsActor & {
      classMeetingId?: string;
      classSectionId: string;
      cursor?: string;
      limit?: number;
    }
  ) => Promise<{
    data: readonly LmsForumThreadRecord[];
    nextCursor: string | null;
  }>;
  listSubmissions: (
    input: LmsActor & { assignmentId: string }
  ) => Promise<readonly LmsSubmissionRecord[]>;
  updateAssignment: (
    input: LmsActor & {
      allowResubmit?: boolean;
      body?: string;
      dueAt: Date;
      expectedVersion: number;
      title: string;
      assignmentId: string;
    }
  ) => Promise<LmsAssignmentRecord>;
  updateMaterial: (
    input: LmsActor & {
      body?: string;
      expectedVersion: number;
      materialId: string;
      title: string;
    }
  ) => Promise<LmsMaterialRecord>;
  publishAssignment: (
    input: LmsActor & { assignmentId: string; expectedVersion: number }
  ) => Promise<void>;
  publishMaterial: (
    input: LmsActor & { expectedVersion: number; materialId: string }
  ) => Promise<void>;
  submitAssignment: (
    input: LmsActor & {
      assignmentId: string;
      body?: string;
      files?: readonly LmsFileInput[];
    }
  ) => Promise<LmsSubmissionRecord>;
}

export interface GradeClassRecord {
  academicPeriodId: string;
  classCode: string;
  classSectionId: string;
  courseCode: string;
  courseId: string;
  courseName: string;
  status: GradeStatus;
  studentCount: number;
  version: number;
}

export interface GradeComponentRecord {
  componentCode: string;
  id: string;
  label: string;
  weight: number;
}

export interface GradeStudentRecord {
  name: string;
  scores: readonly {
    componentId: string;
    score: number | null;
    version: number;
  }[];
  studentId: string;
  nim: string;
}

export interface GradeClassRecordDetail extends GradeClassRecord {
  components: readonly GradeComponentRecord[];
  students: readonly GradeStudentRecord[];
  version: number;
}

export interface GradeStudentResult {
  academicPeriodId: string;
  academicPeriodLabel: string;
  entries: readonly {
    courseCode: string;
    courseName: string;
    credits: number;
    gradeCode: string;
    gradePoint: number;
    roundedScore: number;
  }[];
  ipk: number;
  ips: number;
  periodId: string;
}

export interface GradesService {
  classDetail: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
  }) => Promise<GradeClassRecordDetail>;
  listClasses: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    academicPeriodId?: string;
  }) => Promise<readonly GradeClassRecord[]>;
  lock: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    expectedVersion: number;
  }) => Promise<{ status: "LOCKED" }>;
  publish: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    expectedVersion: number;
  }) => Promise<{ status: "PUBLISHED" }>;
  publishPeriod: (input: {
    academicPeriodId: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    idempotencyKey?: string;
  }) => Promise<{ completedCount: number; jobId: string; status: string }>;
  reopen: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    expectedVersion: number;
    reason: string;
  }) => Promise<{ status: "DRAFT" }>;
  saveScores: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    scores: readonly {
      componentId: string;
      expectedVersion: number;
      score: number;
      studentId: string;
    }[];
  }) => Promise<{ savedCount: number }>;
  studentKhs: (input: {
    academicPeriodId?: string;
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studentId?: string;
  }) => Promise<GradeStudentResult>;
  studentTranscript: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    studentId?: string;
  }) => Promise<{
    entries: readonly GradeStudentResult["entries"][number][];
    ipk: number;
  }>;
  submit: (input: {
    actorRoles: readonly RoleKey[];
    actorUserId: string;
    classSectionId: string;
    expectedVersion: number;
  }) => Promise<{ status: "SUBMITTED" }>;
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
  attendanceService: AttendanceService;
  db: Database;
  clock: Clock;
  curriculumService: CurriculumService;
  logger: ServerLogger;
  lmsService: LmsService;
  request: RequestMetadata;
  identity: IdentityAccess | null;
  identityService: IdentityService;
  gradesService: GradesService;
  masterDataService: MasterDataService;
  settingsService: SettingsService;
  schedulingService: SchedulingService;
  session: Session | null;
  studyPlanService: StudyPlanService;
}

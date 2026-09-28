import type { SettingsService } from "@siakad-itbkmmubar/api/context";
import {
  settingDefinitionByKey,
  settingDefinitions as settingDefinitionCatalog,
  settingKeys,
  SettingsDomainError,
  parseSettingValue,
  settingDefaults,
  validateGradeScaleEntries,
} from "@siakad-itbkmmubar/api/settings";
import type {
  AttendancePolicy,
  BatchPolicy,
  FilePolicy,
  GradingPolicy,
  SchedulingPolicy,
  SecurityPolicy,
  SettingCategory,
  SettingKey,
  SettingScopeType,
} from "@siakad-itbkmmubar/api/settings";
import type { Database } from "@siakad-itbkmmubar/db";
import {
  gradeScaleEntries,
  gradeScaleSets,
  policyActivationHistories,
  settingDefinitions,
  settingValues,
  settingVersions,
} from "@siakad-itbkmmubar/db/schema/settings";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

const DEFAULT_SCOPE: { scopeId: string; scopeType: SettingScopeType } = {
  scopeId: "",
  scopeType: "SYSTEM",
};

const normalizeScope = (scope?: {
  scopeId?: string;
  scopeType?: SettingScopeType;
}): { scopeId: string; scopeType: SettingScopeType } => {
  const scopeType = scope?.scopeType ?? DEFAULT_SCOPE.scopeType;
  const scopeId = scope?.scopeId?.trim() ?? "";
  if (scopeType === "SYSTEM" && scopeId) {
    throw new SettingsDomainError(
      "INVALID_SCOPE",
      "Scope SYSTEM tidak boleh memiliki scope ID."
    );
  }
  if (scopeType !== "SYSTEM" && !scopeId) {
    throw new SettingsDomainError(
      "INVALID_SCOPE",
      "Scope Prodi atau periode akademik wajib memiliki scope ID."
    );
  }
  return { scopeId, scopeType };
};

const parseStoredValue = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SettingsDomainError(
      "INVALID_STORED_SETTING",
      "Nilai setting tersimpan tidak dapat dibaca."
    );
  }
};

const findLatestVersion = <T extends { effectiveFrom: Date; version: number }>(
  versions: readonly T[],
  asOf: Date
): T | undefined => {
  const [latest] = versions
    .filter((version) => version.effectiveFrom.getTime() <= asOf.getTime())
    .toSorted((left, right) => {
      const effectiveOrder =
        right.effectiveFrom.getTime() - left.effectiveFrom.getTime();
      return effectiveOrder || right.version - left.version;
    });
  return latest;
};

const findScopeVersion = <
  T extends {
    effectiveFrom: Date;
    scopeId: string;
    scopeType: string;
    version: number;
  },
>(
  values: readonly T[],
  scopeType: SettingScopeType,
  scopeId: string,
  asOf: Date
): T | undefined =>
  findLatestVersion(
    values.filter(
      (value) => value.scopeType === scopeType && value.scopeId === scopeId
    ),
    asOf
  );

const toJson = (value: unknown): string => JSON.stringify(value);

const toDateString = (value: Date | null): string | null =>
  value?.toISOString() ?? null;

const normalizeKey = (key: string): SettingKey => {
  if (!settingKeys.includes(key as SettingKey)) {
    throw new SettingsDomainError(
      "UNKNOWN_SETTING",
      `Setting ${key} tidak dikenal.`
    );
  }
  return key as SettingKey;
};

const settingCategoryForKey = (key: SettingKey): SettingCategory =>
  settingDefinitionByKey[key].category;

const ensureEffectiveDates = (effectiveFrom: Date): void => {
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new SettingsDomainError(
      "INVALID_EFFECTIVE_DATE",
      "Tanggal mulai berlaku tidak valid."
    );
  }
};

const securityPolicyFromValues = (
  values: Readonly<Record<SettingKey, unknown>>
): SecurityPolicy => ({
  idleTimeoutHours: values.session_idle_timeout_hours as number,
  lockWindowMinutes: values.login_lock_window_minutes as number,
  loginRateLimitAttempts: values.login_rate_limit_attempts as number,
  passwordMinimumLength: values.password_min_length as number,
  refreshIntervalMinutes: values.session_refresh_interval_minutes as number,
  temporaryPasswordTtlHours: values.temporary_password_ttl_hours as number,
});

const schedulingPolicyFromValues = (
  values: Readonly<Record<SettingKey, unknown>>
): SchedulingPolicy => ({
  leadDays: values.schedule_change_lead_days as number,
  onlineMeetingLimit: values.online_meeting_max_per_class as number,
});

const attendancePolicyFromValues = (
  values: Readonly<Record<SettingKey, unknown>>
): AttendancePolicy => {
  const openOffsetMinutes = values.attendance_open_offset_minutes as number;
  const closeOffsetMinutes = values.attendance_close_offset_minutes as number;
  if (openOffsetMinutes > 1440 || closeOffsetMinutes > 1440) {
    throw new SettingsDomainError(
      "INVALID_ATTENDANCE_WINDOW",
      "Window presensi berada di luar batas satu hari."
    );
  }
  return {
    closeOffsetMinutes,
    openOffsetMinutes,
    radiusMeters: values.attendance_radius_meters as number,
  };
};

const filePolicyFromValues = (
  values: Readonly<Record<SettingKey, unknown>>,
  category: string
): FilePolicy => {
  if (!category.trim()) {
    throw new SettingsDomainError(
      "INVALID_FILE_CATEGORY",
      "Kategori file wajib diisi."
    );
  }
  return {
    allowedMimeTypes: values.allowed_mime_types as readonly string[],
    maxSizeBytes: values.upload_max_size_bytes as number,
  };
};

const batchPolicyFromValues = (
  values: Readonly<Record<SettingKey, unknown>>
): BatchPolicy => ({
  importChunkSize: values.import_chunk_size as number,
  importMaxRows: values.import_max_rows as number,
});

export const createSettingsService = ({
  database,
  now = () => new Date(),
}: {
  database: Database;
  now?: () => Date;
}): SettingsService => {
  interface DefinitionRecord {
    category: string;
    defaultValue: unknown;
    description: string;
    id: string;
    key: string;
    label: string;
    maxValue: number | null;
    minValue: number | null;
    valueType: string;
  }

  const loadDefinitions = async (category?: SettingCategory) => {
    const definitions = await database
      .select()
      .from(settingDefinitions)
      .where(category ? eq(settingDefinitions.category, category) : undefined)
      .orderBy(settingDefinitions.category, settingDefinitions.key);
    if (definitions.length > 0) {
      return definitions.map((definition) => ({
        ...definition,
        defaultValue: parseStoredValue(definition.defaultValue),
      })) satisfies DefinitionRecord[];
    }
    return settingDefinitionCatalog
      .filter((definition) => !category || definition.category === category)
      .map((definition) => ({
        ...definition,
        id: definition.key,
      })) satisfies DefinitionRecord[];
  };

  const loadEffectiveValues = async ({
    asOf,
    category,
    scope,
  }: {
    asOf: Date;
    category?: SettingCategory;
    scope: { scopeId: string; scopeType: SettingScopeType };
  }): Promise<{
    definitions: readonly DefinitionRecord[];
    values: Readonly<Record<SettingKey, unknown>>;
    versions: Readonly<
      Record<
        SettingKey,
        { effectiveFrom: Date; id: string; version: number } | null
      >
    >;
    inherited: Readonly<Record<SettingKey, boolean>>;
  }> => {
    const definitions = await loadDefinitions(category);
    const definitionIds = definitions.map((definition) => definition.id);
    const storedValues = definitionIds.length
      ? await database
          .select()
          .from(settingValues)
          .where(inArray(settingValues.definitionId, definitionIds))
      : [];
    const valueIds = storedValues.map((value) => value.id);
    const storedVersions = valueIds.length
      ? await database
          .select()
          .from(settingVersions)
          .where(inArray(settingVersions.settingValueId, valueIds))
      : [];
    const values = {} as Record<SettingKey, unknown>;
    const versions = {} as Record<
      SettingKey,
      { effectiveFrom: Date; id: string; version: number } | null
    >;
    const inherited = {} as Record<SettingKey, boolean>;

    for (const definition of definitions) {
      const key = normalizeKey(definition.key);
      const definitionRows = storedValues.filter(
        (value) => value.definitionId === definition.id
      );
      const versionRows = storedVersions
        .filter((version) =>
          definitionRows.some((value) => value.id === version.settingValueId)
        )
        .map((version) => ({
          effectiveFrom: version.effectiveFrom,
          id: version.id,
          scopeId:
            definitionRows.find((value) => value.id === version.settingValueId)
              ?.scopeId ?? "",
          scopeType:
            definitionRows.find((value) => value.id === version.settingValueId)
              ?.scopeType ?? "SYSTEM",
          value: parseStoredValue(version.valueJson),
          version: version.version,
        }));
      const requestedVersion = findScopeVersion(
        versionRows,
        scope.scopeType,
        scope.scopeId,
        asOf
      );
      const systemVersion = findScopeVersion(versionRows, "SYSTEM", "", asOf);
      const selected = requestedVersion ?? systemVersion;
      const fallback = settingDefaults[key] ?? definition.defaultValue;
      values[key] = selected?.value ?? fallback;
      versions[key] = selected
        ? {
            effectiveFrom: selected.effectiveFrom,
            id: selected.id,
            version: selected.version,
          }
        : null;
      inherited[key] = !requestedVersion && Boolean(systemVersion);
    }
    return { definitions, inherited, values, versions };
  };

  const list: SettingsService["list"] = async ({
    asOf = now(),
    category,
    scopeId,
    scopeType,
  }) => {
    const scope = normalizeScope({ scopeId, scopeType });
    const loaded = await loadEffectiveValues({ asOf, category, scope });
    return {
      asOf: asOf.toISOString(),
      items: loaded.definitions.map((definition) => {
        const key = normalizeKey(definition.key);
        const version = loaded.versions[key];
        const catalogDefinition = settingDefinitionByKey[key];
        return {
          category: definition.category as SettingCategory,
          defaultValue:
            catalogDefinition?.defaultValue ?? definition.defaultValue,
          description: definition.description,
          effectiveFrom: toDateString(version?.effectiveFrom ?? null),
          inherited: loaded.inherited[key] ?? false,
          key,
          label: definition.label,
          maxValue: definition.maxValue,
          minValue: definition.minValue,
          value: loaded.values[key],
          valueType: definition.valueType,
          version: version?.version ?? 0,
          versionId: version?.id ?? null,
        };
      }),
      scope,
    };
  };

  const getPolicyValues = async (scope?: {
    scopeId: string;
    scopeType: SettingScopeType;
  }) => {
    const loaded = await loadEffectiveValues({
      asOf: now(),
      scope: normalizeScope(scope),
    });
    return loaded.values;
  };

  // The publish operation intentionally validates every item before creating the atomic batch.
  // eslint-disable-next-line complexity
  const publish: SettingsService["publish"] = async ({
    actorUserId,
    effectiveFrom,
    expectedVersions,
    note,
    scope: rawScope,
    values: inputValues,
  }) => {
    ensureEffectiveDates(effectiveFrom);
    const scope = normalizeScope(rawScope);
    const entries = Object.entries(inputValues) as [string, unknown][];
    if (entries.length === 0) {
      throw new SettingsDomainError(
        "EMPTY_SETTING_UPDATE",
        "Tidak ada setting yang diubah."
      );
    }
    const normalizedValues = entries.map(([rawKey, value]) => {
      const key = normalizeKey(rawKey);
      return { key, value: parseSettingValue(key, value) };
    });
    const categories = new Set(
      normalizedValues.map(({ key }) => settingCategoryForKey(key))
    );
    if (categories.size > 1) {
      throw new SettingsDomainError(
        "MULTIPLE_SETTING_CATEGORIES",
        "Satu publikasi hanya boleh mengubah satu kelompok kebijakan."
      );
    }
    if ([...categories][0] === "ATTENDANCE") {
      const openOffset = normalizedValues.find(
        ({ key }) => key === "attendance_open_offset_minutes"
      )?.value;
      const closeOffset = normalizedValues.find(
        ({ key }) => key === "attendance_close_offset_minutes"
      )?.value;
      if (
        typeof openOffset === "number" &&
        typeof closeOffset === "number" &&
        closeOffset < openOffset
      ) {
        throw new SettingsDomainError(
          "INVALID_ATTENDANCE_WINDOW",
          "Offset tutup presensi tidak boleh lebih awal dari offset buka presensi."
        );
      }
    }
    const definitions = await loadDefinitions([...categories][0]);
    const definitionByKey = new Map(
      definitions.map((definition) => [definition.key, definition])
    );
    const currentValues = await database
      .select()
      .from(settingValues)
      .where(
        and(
          eq(settingValues.scopeType, scope.scopeType),
          eq(settingValues.scopeId, scope.scopeId),
          inArray(
            settingValues.definitionId,
            normalizedValues.flatMap(({ key }) => {
              const definition = definitionByKey.get(key);
              return definition ? [definition.id] : [];
            })
          )
        )
      );
    const currentVersionIds = currentValues
      .map((value) => value.currentVersionId)
      .filter((value): value is string => Boolean(value));
    const currentVersions = currentVersionIds.length
      ? await database
          .select()
          .from(settingVersions)
          .where(inArray(settingVersions.id, currentVersionIds))
      : [];
    const currentVersionByValueId = new Map(
      currentVersions.map((version) => [version.settingValueId, version])
    );
    const statements: unknown[] = [];
    const versionIds: string[] = [];
    const currentValueByDefinitionId = new Map(
      currentValues.map((value) => [value.definitionId, value])
    );

    for (const { key, value } of normalizedValues) {
      const definition = definitionByKey.get(key);
      if (!definition) {
        throw new SettingsDomainError(
          "UNKNOWN_SETTING",
          `Setting ${key} belum disiapkan di database.`
        );
      }
      const currentValue = currentValueByDefinitionId.get(definition.id);
      const currentVersion = currentValue
        ? currentVersionByValueId.get(currentValue.id)
        : undefined;
      const expectedVersion = expectedVersions?.[key];
      if (
        expectedVersion !== undefined &&
        (currentVersion?.version ?? 0) !== expectedVersion
      ) {
        throw new SettingsDomainError(
          "SETTING_VERSION_CONFLICT",
          `Setting ${definition.label} sudah diubah oleh pengguna lain.`
        );
      }
      const settingValueId = currentValue?.id ?? crypto.randomUUID();
      const versionId = crypto.randomUUID();
      versionIds.push(versionId);
      if (!currentValue) {
        statements.push(
          database
            .insert(settingValues)
            .values({
              createdAt: now(),
              currentVersionId: null,
              definitionId: definition.id,
              id: settingValueId,
              scopeId: scope.scopeId,
              scopeType: scope.scopeType,
              updatedAt: now(),
            })
            .onConflictDoNothing()
        );
      }
      const nextVersion = (currentVersion?.version ?? 0) + 1;
      statements.push(
        database.insert(settingVersions).values({
          createdAt: now(),
          createdBy: actorUserId,
          effectiveFrom,
          id: versionId,
          note: note ?? null,
          settingValueId,
          valueJson: toJson(value),
          version: nextVersion,
        }),
        database
          .update(settingValues)
          .set({ currentVersionId: versionId, updatedAt: now() })
          .where(
            currentValue
              ? and(
                  eq(settingValues.id, settingValueId),
                  currentValue.currentVersionId
                    ? eq(
                        settingValues.currentVersionId,
                        currentValue.currentVersionId
                      )
                    : isNull(settingValues.currentVersionId)
                )
              : eq(settingValues.id, settingValueId)
          ),
        database.insert(policyActivationHistories).values({
          action: "PUBLISHED",
          activatedAt: now(),
          activatedBy: actorUserId,
          id: crypto.randomUUID(),
          metadata: JSON.stringify({ key, note: note ?? null }),
          policyId: versionId,
          policyType: "SETTING_VERSION",
          previousPolicyId: currentValue?.currentVersionId ?? null,
          scopeId: scope.scopeId,
          scopeType: scope.scopeType,
        })
      );
    }
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
    return { effectiveFrom: effectiveFrom.toISOString(), versionIds };
  };

  const publishGradeScale: SettingsService["publishGradeScale"] = async ({
    actorUserId,
    effectiveFrom,
    entries,
    name,
    scope: rawScope,
  }) => {
    ensureEffectiveDates(effectiveFrom);
    const scope = normalizeScope(rawScope);
    const normalizedEntries = validateGradeScaleEntries(entries);
    const [lastScale] = await database
      .select({ version: gradeScaleSets.version })
      .from(gradeScaleSets)
      .where(
        and(
          eq(gradeScaleSets.scopeType, scope.scopeType),
          eq(gradeScaleSets.scopeId, scope.scopeId)
        )
      )
      .orderBy(desc(gradeScaleSets.version))
      .limit(1);
    const version = (lastScale?.version ?? 0) + 1;
    const id = crypto.randomUUID();
    const statements = [
      database.insert(gradeScaleSets).values({
        createdAt: now(),
        createdBy: actorUserId,
        effectiveFrom,
        id,
        name: name.trim(),
        scopeId: scope.scopeId,
        scopeType: scope.scopeType,
        version,
      }),
      database.insert(gradeScaleEntries).values(
        normalizedEntries.map((entry, sortOrder) => ({
          ...entry,
          id: crypto.randomUUID(),
          scaleSetId: id,
          sortOrder,
        }))
      ),
      database.insert(policyActivationHistories).values({
        action: "PUBLISHED",
        activatedAt: now(),
        activatedBy: actorUserId,
        id: crypto.randomUUID(),
        metadata: JSON.stringify({ name: name.trim() }),
        policyId: id,
        policyType: "GRADE_SCALE",
        previousPolicyId: null,
        scopeId: scope.scopeId,
        scopeType: scope.scopeType,
      }),
    ];
    await database.batch(
      statements as unknown as Parameters<Database["batch"]>[0]
    );
    return { id, version };
  };

  const listGradeScales: SettingsService["listGradeScales"] = async (input) => {
    const scope = normalizeScope(input);
    const sets = await database
      .select()
      .from(gradeScaleSets)
      .where(
        and(
          eq(gradeScaleSets.scopeType, scope.scopeType),
          eq(gradeScaleSets.scopeId, scope.scopeId)
        )
      )
      .orderBy(desc(gradeScaleSets.version));
    const entries = sets.length
      ? await database
          .select()
          .from(gradeScaleEntries)
          .where(
            inArray(
              gradeScaleEntries.scaleSetId,
              sets.map((set) => set.id)
            )
          )
          .orderBy(gradeScaleEntries.sortOrder)
      : [];
    return sets.map((set) => ({
      effectiveFrom: set.effectiveFrom.toISOString(),
      entries: entries
        .filter((entry) => entry.scaleSetId === set.id)
        .map(({ gradeCode, label, maxScore, minScore, qualityPoints }) => ({
          gradeCode,
          label,
          maxScore,
          minScore,
          qualityPoints,
        })),
      id: set.id,
      name: set.name,
      scopeId: set.scopeId,
      scopeType: set.scopeType as SettingScopeType,
      version: set.version,
    }));
  };

  const rollback: SettingsService["rollback"] = async ({
    actorUserId,
    effectiveFrom,
    note,
    versionId,
  }) => {
    const [version] = await database
      .select()
      .from(settingVersions)
      .where(eq(settingVersions.id, versionId))
      .limit(1);
    if (!version) {
      throw new SettingsDomainError(
        "VERSION_NOT_FOUND",
        "Versi setting tidak ditemukan."
      );
    }
    const [value] = await database
      .select()
      .from(settingValues)
      .where(eq(settingValues.id, version.settingValueId))
      .limit(1);
    if (!value) {
      throw new SettingsDomainError(
        "SETTING_NOT_FOUND",
        "Setting untuk versi tersebut tidak ditemukan."
      );
    }
    const [definition] = await database
      .select()
      .from(settingDefinitions)
      .where(eq(settingDefinitions.id, value.definitionId))
      .limit(1);
    if (!definition) {
      throw new SettingsDomainError(
        "SETTING_NOT_FOUND",
        "Definisi setting tidak ditemukan."
      );
    }
    const key = normalizeKey(definition.key);
    const currentVersion = value.currentVersionId
      ? await database
          .select({ version: settingVersions.version })
          .from(settingVersions)
          .where(eq(settingVersions.id, value.currentVersionId))
          .limit(1)
      : [];
    return publish({
      actorUserId,
      effectiveFrom,
      expectedVersions: { [key]: currentVersion[0]?.version ?? 0 },
      note: note ?? `Rollback dari versi ${version.version}.`,
      scope: {
        scopeId: value.scopeId,
        scopeType: value.scopeType as SettingScopeType,
      },
      values: { [key]: parseStoredValue(version.valueJson) },
    });
  };

  const getGradingPolicy: SettingsService["getGradingPolicy"] = async (
    scope,
    asOf = now()
  ) => {
    const values = await loadEffectiveValues({
      asOf,
      scope: normalizeScope(scope),
    });
    const scaleSets = await database
      .select()
      .from(gradeScaleSets)
      .where(
        or(
          and(
            eq(gradeScaleSets.scopeType, normalizeScope(scope).scopeType),
            eq(gradeScaleSets.scopeId, normalizeScope(scope).scopeId)
          ),
          and(
            eq(gradeScaleSets.scopeType, "SYSTEM"),
            eq(gradeScaleSets.scopeId, "")
          )
        )
      )
      .orderBy(
        desc(gradeScaleSets.effectiveFrom),
        desc(gradeScaleSets.version)
      );
    const selectedScale =
      scaleSets.find(
        (scale) =>
          scale.effectiveFrom.getTime() <= asOf.getTime() &&
          scale.scopeType === normalizeScope(scope).scopeType &&
          scale.scopeId === normalizeScope(scope).scopeId
      ) ??
      scaleSets.find(
        (scale) =>
          scale.effectiveFrom.getTime() <= asOf.getTime() &&
          scale.scopeType === "SYSTEM" &&
          scale.scopeId === ""
      );
    const scaleEntries = selectedScale
      ? await database
          .select()
          .from(gradeScaleEntries)
          .where(eq(gradeScaleEntries.scaleSetId, selectedScale.id))
          .orderBy(gradeScaleEntries.sortOrder)
      : [];
    const result = values.values;
    return {
      retakePolicy: result.retake_policy as GradingPolicy["retakePolicy"],
      roundingMethod: result.rounding_method as GradingPolicy["roundingMethod"],
      roundingPrecision: result.rounding_precision as number,
      scale: scaleEntries.map(
        ({ gradeCode, label, maxScore, minScore, qualityPoints }) => ({
          gradeCode,
          label,
          maxScore,
          minScore,
          qualityPoints,
        })
      ),
      scaleVersionId: selectedScale?.id ?? null,
    };
  };

  return {
    getAttendancePolicy: async (scope) =>
      attendancePolicyFromValues(await getPolicyValues(scope)),
    getBatchPolicy: async (scope) =>
      batchPolicyFromValues(await getPolicyValues(scope)),
    getFilePolicy: async (category, scope) =>
      filePolicyFromValues(await getPolicyValues(scope), category),
    getGradingPolicy,
    getSchedulingPolicy: async (scope) =>
      schedulingPolicyFromValues(await getPolicyValues(scope)),
    getSecurityPolicy: async (scope) =>
      securityPolicyFromValues(await getPolicyValues(scope)),
    list,
    listGradeScales,
    publish,
    publishGradeScale,
    rollback,
  };
};

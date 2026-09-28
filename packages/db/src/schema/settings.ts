import { user } from "@db/schema/auth";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const settingCategories = [
  "SECURITY",
  "SCHEDULING",
  "ATTENDANCE",
  "GRADING",
  "FILE",
  "BATCH",
] as const;

export const settingScopeTypes = [
  "SYSTEM",
  "STUDY_PROGRAM",
  "ACADEMIC_PERIOD",
] as const;

export const settingValueTypes = [
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "STRING",
  "ENUM",
  "JSON",
] as const;

export const settingDefinitions = sqliteTable(
  "setting_definitions",
  {
    category: text("category").notNull(),
    createdAt: timestamp("created_at"),
    defaultValue: text("default_value").notNull(),
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    maxValue: real("max_value"),
    minValue: real("min_value"),
    updatedAt: timestamp("updated_at"),
    valueType: text("value_type").notNull(),
  },
  (table) => [
    uniqueIndex("setting_definitions_key_uq").on(table.key),
    index("setting_definitions_category_idx").on(table.category),
  ]
);

export const settingValues = sqliteTable(
  "setting_values",
  {
    createdAt: timestamp("created_at"),
    currentVersionId: text("current_version_id"),
    definitionId: text("definition_id")
      .notNull()
      .references(() => settingDefinitions.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    scopeId: text("scope_id").default("").notNull(),
    scopeType: text("scope_type").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("setting_values_definition_scope_uq").on(
      table.definitionId,
      table.scopeType,
      table.scopeId
    ),
    index("setting_values_scope_idx").on(table.scopeType, table.scopeId),
  ]
);

export const settingVersions = sqliteTable(
  "setting_versions",
  {
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    effectiveFrom: integer("effective_from", {
      mode: "timestamp_ms",
    }).notNull(),
    id: text("id").primaryKey(),
    note: text("note"),
    settingValueId: text("setting_value_id")
      .notNull()
      .references(() => settingValues.id, { onDelete: "cascade" }),
    valueJson: text("value_json").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("setting_versions_value_version_uq").on(
      table.settingValueId,
      table.version
    ),
    uniqueIndex("setting_versions_value_effective_uq").on(
      table.settingValueId,
      table.effectiveFrom
    ),
    index("setting_versions_effective_idx").on(
      table.settingValueId,
      table.effectiveFrom
    ),
  ]
);

export const gradeScaleSets = sqliteTable(
  "grade_scale_sets",
  {
    createdAt: timestamp("created_at"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    effectiveFrom: integer("effective_from", {
      mode: "timestamp_ms",
    }).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    scopeId: text("scope_id").default("").notNull(),
    scopeType: text("scope_type").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("grade_scale_sets_scope_version_uq").on(
      table.scopeType,
      table.scopeId,
      table.version
    ),
    uniqueIndex("grade_scale_sets_scope_effective_uq").on(
      table.scopeType,
      table.scopeId,
      table.effectiveFrom
    ),
    index("grade_scale_sets_effective_idx").on(
      table.scopeType,
      table.scopeId,
      table.effectiveFrom
    ),
  ]
);

export const gradeScaleEntries = sqliteTable(
  "grade_scale_entries",
  {
    gradeCode: text("grade_code").notNull(),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    maxScore: real("max_score").notNull(),
    minScore: real("min_score").notNull(),
    qualityPoints: real("quality_points").notNull(),
    scaleSetId: text("scale_set_id")
      .notNull()
      .references(() => gradeScaleSets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("grade_scale_entries_code_uq").on(
      table.scaleSetId,
      table.gradeCode
    ),
    index("grade_scale_entries_scale_idx").on(
      table.scaleSetId,
      table.sortOrder
    ),
    check(
      "grade_scale_entries_range_ck",
      sql`${table.minScore} >= 0 AND ${table.maxScore} <= 100 AND ${table.minScore} <= ${table.maxScore}`
    ),
    check(
      "grade_scale_entries_quality_ck",
      sql`${table.qualityPoints} >= 0 AND ${table.qualityPoints} <= 4`
    ),
  ]
);

export const policyActivationHistories = sqliteTable(
  "policy_activation_histories",
  {
    action: text("action").notNull(),
    activatedAt: timestamp("activated_at"),
    activatedBy: text("activated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    policyId: text("policy_id").notNull(),
    policyType: text("policy_type").notNull(),
    previousPolicyId: text("previous_policy_id"),
    scopeId: text("scope_id").default("").notNull(),
    scopeType: text("scope_type").notNull(),
  },
  (table) => [
    index("policy_activation_histories_policy_idx").on(
      table.policyType,
      table.policyId
    ),
    index("policy_activation_histories_activated_at_idx").on(table.activatedAt),
  ]
);

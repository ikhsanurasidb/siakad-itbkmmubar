import { describe, expect, test } from "bun:test";

import {
  parseSettingValue,
  settingDefaults,
  validateGradeScaleEntries,
} from "../packages/api/src/settings";

describe("SIAKAD-03 settings rules", () => {
  test("ships the locked security and scheduling defaults", () => {
    expect(settingDefaults.session_idle_timeout_hours).toBe(72);
    expect(settingDefaults.password_min_length).toBe(16);
    expect(settingDefaults.schedule_change_lead_days).toBe(7);
    expect(settingDefaults.online_meeting_max_per_class).toBe(2);
    expect(settingDefaults.attendance_radius_meters).toBe(1000);
  });

  test("rejects grade scale overlap and gaps", () => {
    const validEntries = [
      {
        gradeCode: "A",
        label: "Sangat baik",
        maxScore: 100,
        minScore: 80,
        qualityPoints: 4,
      },
      {
        gradeCode: "B",
        label: "Baik",
        maxScore: 80,
        minScore: 60,
        qualityPoints: 3,
      },
      {
        gradeCode: "C",
        label: "Cukup",
        maxScore: 60,
        minScore: 0,
        qualityPoints: 2,
      },
    ];
    expect(validateGradeScaleEntries(validEntries)).toHaveLength(3);
    expect(() =>
      validateGradeScaleEntries([
        ...validEntries,
        {
          gradeCode: "AB",
          label: "Overlap",
          maxScore: 90,
          minScore: 70,
          qualityPoints: 3.5,
        },
      ])
    ).toThrow("bertumpang tindih");
    expect(() =>
      validateGradeScaleEntries([
        {
          gradeCode: "A",
          label: "Sangat baik",
          maxScore: 100,
          minScore: 81,
          qualityPoints: 4,
        },
        {
          gradeCode: "B",
          label: "Baik",
          maxScore: 79,
          minScore: 0,
          qualityPoints: 3,
        },
      ])
    ).toThrow("gap");
  });

  test("keeps the password minimum at sixteen characters", () => {
    expect(() => parseSettingValue("password_min_length", 15)).toThrow(
      "Panjang minimum kata sandi"
    );
    expect(parseSettingValue("password_min_length", 16)).toBe(16);
  });

  test("rejects a scale that does not cover zero to one hundred", () => {
    expect(() =>
      validateGradeScaleEntries([
        {
          gradeCode: "A",
          label: "Sangat baik",
          maxScore: 99,
          minScore: 50,
          qualityPoints: 4,
        },
        {
          gradeCode: "B",
          label: "Baik",
          maxScore: 50,
          minScore: 1,
          qualityPoints: 3,
        },
      ])
    ).toThrow("mencakup seluruh rentang");
  });
});

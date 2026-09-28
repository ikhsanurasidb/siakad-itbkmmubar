import { describe, expect, test } from "bun:test";

import {
  assertGradeTransition,
  calculateFinalGrade,
  calculateStudyResult,
  GradeDomainError,
  roundScore,
} from "../packages/api/src/grades";

const policy = {
  retakePolicy: "HIGHEST" as const,
  roundingMethod: "HALF_UP" as const,
  roundingPrecision: 2,
  scale: [
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
      maxScore: 79.99,
      minScore: 0,
      qualityPoints: 3,
    },
  ],
  scaleVersionId: "scale-1",
};

describe("SIAKAD-09 grade rules", () => {
  test("uses the same weighted calculation for preview and final values", () => {
    expect(
      calculateFinalGrade({
        components: [
          { componentCode: "TUGAS", label: "Tugas", weight: 40 },
          { componentCode: "UJIAN", label: "Ujian", weight: 60 },
        ],
        policy,
        scores: [
          { componentCode: "TUGAS", score: 80 },
          { componentCode: "UJIAN", score: 90 },
        ],
      })
    ).toMatchObject({
      gradeCode: "A",
      rawScore: 86,
      roundedScore: 86,
      scaleVersionId: "scale-1",
    });
  });

  test("rejects incomplete weights and missing required scores", () => {
    expect(() =>
      calculateFinalGrade({
        components: [{ componentCode: "TUGAS", label: "Tugas", weight: 40 }],
        policy,
        scores: [{ componentCode: "TUGAS", score: 90 }],
      })
    ).toThrow("tepat 100%");
    expect(() =>
      calculateFinalGrade({
        components: [
          { componentCode: "TUGAS", label: "Tugas", weight: 40 },
          { componentCode: "UJIAN", label: "Ujian", weight: 60 },
        ],
        policy,
        scores: [{ componentCode: "TUGAS", score: 90 }],
      })
    ).toThrow(GradeDomainError);
  });

  test("handles rounding boundaries for every configured mode", () => {
    expect(roundScore(2.345, 2, "HALF_UP")).toBe(2.35);
    expect(roundScore(2.345, 2, "HALF_EVEN")).toBe(2.34);
    expect(roundScore(2.349, 2, "TRUNCATE")).toBe(2.34);
  });

  test("selects the highest retake and calculates IPS/IPK from quality points", () => {
    const result = calculateStudyResult({
      allPublished: [
        {
          academicPeriodId: "p1",
          attempt: 1,
          courseId: "c1",
          credits: 3,
          gradePoint: 2,
          studentId: "s1",
          takenAt: "2026-01-01",
        },
        {
          academicPeriodId: "p1",
          attempt: 2,
          courseId: "c1",
          credits: 3,
          gradePoint: 4,
          studentId: "s1",
          takenAt: "2026-02-01",
        },
        {
          academicPeriodId: "p1",
          attempt: 1,
          courseId: "c2",
          credits: 2,
          gradePoint: 3,
          studentId: "s1",
          takenAt: "2026-01-02",
        },
      ],
      currentPeriodId: "p1",
      retakePolicy: "HIGHEST",
    });
    expect(result.countedCredits).toBe(5);
    expect(result.ips).toBe(3.6);
    expect(result.ipk).toBe(3.6);
    expect(result.selected).toHaveLength(2);
  });

  test("allows only the locked state to be published", () => {
    expect(() => assertGradeTransition("DRAFT", "PUBLISHED")).toThrow(
      GradeDomainError
    );
    expect(() => assertGradeTransition("LOCKED", "PUBLISHED")).not.toThrow();
  });
});

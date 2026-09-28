import { describe, expect, test } from "bun:test";

import {
  StudyPlanDomainError,
  calculateStudyPlanTotals,
  normalizeStudyPlanReason,
  packageStudyPlanStrategy,
} from "../packages/api/src/study-plan";

describe("SIAKAD-05 KRS Paket rules", () => {
  test("generates package items without coupling the strategy to free KRS", () => {
    expect(
      packageStudyPlanStrategy.generate({
        courses: [
          {
            courseId: "course-1",
            credits: 3,
            curriculumCourseId: "curriculum-course-1",
            semester: 1,
            sortOrder: 1,
          },
        ],
      })
    ).toEqual([
      {
        courseId: "course-1",
        credits: 3,
        curriculumCourseId: "curriculum-course-1",
        semester: 1,
        sortOrder: 1,
        source: "PACKAGE",
      },
    ]);
  });

  test("calculates deterministic course and credit totals", () => {
    expect(calculateStudyPlanTotals([{ credits: 3 }, { credits: 2 }])).toEqual({
      totalCourses: 2,
      totalCredits: 5,
    });
  });

  test("requires a meaningful reason to reopen a final KRS", () => {
    expect(() => normalizeStudyPlanReason("singkat")).toThrow(
      StudyPlanDomainError
    );
    expect(normalizeStudyPlanReason("  Perubahan data kurikulum  ")).toBe(
      "Perubahan data kurikulum"
    );
  });
});

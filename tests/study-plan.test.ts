import { describe, expect, test } from "bun:test";

import {
  getStudyPlanFailureAction,
  StudyPlanDomainError,
  calculateStudyPlanTotals,
  deriveStudentSemester,
  filterCoursesForSemester,
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

  test("provides actionable instructions for generation failures", () => {
    expect(getStudyPlanFailureAction("CURRICULUM_NOT_FOUND")).toContain(
      "aktifkan kurikulum"
    );
    expect(getStudyPlanFailureAction("CURRICULUM_EMPTY")).toContain(
      "tambahkan minimal satu mata kuliah"
    );
    expect(getStudyPlanFailureAction("CURRICULUM_DUPLICATE_COURSE")).toContain(
      "hapus mata kuliah"
    );
  });

  test("derives the running semester from cohort and academic period", () => {
    expect(
      deriveStudentSemester({
        academicYearStartYear: 2026,
        cohortEntryYear: 2026,
        term: "ODD",
      })
    ).toBe(1);
    expect(
      deriveStudentSemester({
        academicYearStartYear: 2026,
        cohortEntryYear: 2025,
        term: "EVEN",
      })
    ).toBe(4);
    expect(
      deriveStudentSemester({
        academicYearStartYear: 2026,
        cohortEntryYear: 2022,
        term: "ODD",
      })
    ).toBeNull();
  });

  test("limits package input to the student's running semester", () => {
    const courses = [
      { courseId: "course-1", semester: 1 },
      { courseId: "course-3", semester: 3 },
      { courseId: "course-1b", semester: 1 },
    ];
    expect(filterCoursesForSemester(courses, 3)).toEqual([courses[1]]);
  });
});

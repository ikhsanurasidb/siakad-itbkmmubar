import { describe, expect, test } from "bun:test";

import {
  DEFAULT_COURSE_ASSESSMENT_COMPONENTS,
  CurriculumDomainError,
  validateAssessmentComponents,
  validateCurriculumStructure,
} from "../packages/api/src/curriculum";

describe("SIAKAD-04 curriculum rules", () => {
  test("limits curriculum semesters to one through eight", () => {
    expect(() =>
      validateCurriculumStructure([
        { courseId: "course-1", courseType: "REQUIRED", semester: 9 },
      ])
    ).toThrow("1–8");
  });

  test("rejects duplicate courses in one curriculum", () => {
    expect(() =>
      validateCurriculumStructure([
        { courseId: "course-1", courseType: "REQUIRED", semester: 1 },
        { courseId: "course-1", courseType: "ELECTIVE", semester: 2 },
      ])
    ).toThrow("lebih dari satu kali");
  });

  test("allows incomplete draft weights but blocks activation", () => {
    const draft = validateAssessmentComponents([
      { componentCode: "TUGAS", label: "Tugas", weight: 40 },
    ]);
    expect(draft[0]?.weight).toBe(40);
    expect(() => validateAssessmentComponents(draft, true)).toThrow(
      "tepat 100%"
    );
  });

  test("accepts the default assessment policy for activation", () => {
    expect(
      validateAssessmentComponents(DEFAULT_COURSE_ASSESSMENT_COMPONENTS, true)
    ).toEqual(DEFAULT_COURSE_ASSESSMENT_COMPONENTS);
  });

  test("prevents assessment weights above one hundred percent", () => {
    expect(() =>
      validateAssessmentComponents([
        { componentCode: "TUGAS", label: "Tugas", weight: 101 },
      ])
    ).toThrow(CurriculumDomainError);
  });
});

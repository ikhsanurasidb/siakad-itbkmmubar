import type {
  StudyPlanMode,
  StudyPlanStatus,
} from "@siakad-itbkmmubar/api/study-plan";

export const studyPlanStatusLabels: Record<StudyPlanStatus, string> = {
  DRAFT: "Draft",
  FINAL: "Final",
};

export const studyPlanStatusClassNames: Record<StudyPlanStatus, string> = {
  DRAFT: "bg-[#fff2df] text-[#9a5a00]",
  FINAL: "bg-[#e7f7ef] text-[#137a4b]",
};

export const studyPlanModeLabels: Record<StudyPlanMode, string> = {
  FREE: "KRS Bebas",
  PACKAGE: "KRS Paket",
};

export const formatStudyPlanDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatStudyPlanDateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const recordText = (
  record: Record<string, unknown>,
  key: string
): string => {
  const value = record[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

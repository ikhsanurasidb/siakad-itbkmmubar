import { createFileRoute } from "@tanstack/react-router";

import StudyPlanListPage from "@/components/study-plan-list-page";

const Page = () => (
  <StudyPlanListPage
    basePath="/mahasiswa/krs"
    canGenerate={false}
    roleName="Mahasiswa"
  />
);

export const Route = createFileRoute("/_auth/mahasiswa/krs/")({
  component: Page,
});

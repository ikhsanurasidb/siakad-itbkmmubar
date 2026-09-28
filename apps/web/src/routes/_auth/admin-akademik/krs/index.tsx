import { createFileRoute } from "@tanstack/react-router";

import StudyPlanListPage from "@/components/study-plan-list-page";

const Page = () => (
  <StudyPlanListPage
    basePath="/admin-akademik/krs"
    canGenerate
    roleName="Admin Akademik"
  />
);

export const Route = createFileRoute("/_auth/admin-akademik/krs/")({
  component: Page,
});

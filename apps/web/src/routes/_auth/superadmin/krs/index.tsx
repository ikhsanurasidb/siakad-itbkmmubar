import { createFileRoute } from "@tanstack/react-router";

import StudyPlanListPage from "@/components/study-plan-list-page";

const Page = () => (
  <StudyPlanListPage
    basePath="/superadmin/krs"
    canGenerate={true}
    roleName="Superadmin"
  />
);

export const Route = createFileRoute("/_auth/superadmin/krs/")({
  component: Page,
});

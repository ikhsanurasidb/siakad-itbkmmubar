import { createFileRoute } from "@tanstack/react-router";

import StudyPlanGeneratePage from "@/components/study-plan-generate-page";

const Page = () => (
  <StudyPlanGeneratePage basePath="/superadmin/krs" roleName="Superadmin" />
);

export const Route = createFileRoute("/_auth/superadmin/krs/generate")({
  component: Page,
});

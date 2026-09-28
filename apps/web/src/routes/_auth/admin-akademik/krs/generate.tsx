import { createFileRoute } from "@tanstack/react-router";

import StudyPlanGeneratePage from "@/components/study-plan-generate-page";

export const Route = createFileRoute("/_auth/admin-akademik/krs/generate")({
  component: StudyPlanGeneratePage,
});

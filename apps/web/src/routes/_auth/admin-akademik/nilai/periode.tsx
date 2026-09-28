import { createFileRoute } from "@tanstack/react-router";

import { GradePublicationPage } from "@/components/grades-page";

const Page = () => (
  <GradePublicationPage roleName="Admin Akademik" view="period" />
);

export const Route = createFileRoute("/_auth/admin-akademik/nilai/periode")({
  component: Page,
});

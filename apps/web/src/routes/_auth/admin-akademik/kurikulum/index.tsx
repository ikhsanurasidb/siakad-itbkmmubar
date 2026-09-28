import { createFileRoute } from "@tanstack/react-router";

import CurriculumListPage from "@/components/curriculum-list-page";

const Page = () => (
  <CurriculumListPage
    basePath="/admin-akademik/kurikulum"
    canManage={false}
    roleName="Admin Akademik"
  />
);

export const Route = createFileRoute("/_auth/admin-akademik/kurikulum/")({
  component: Page,
});

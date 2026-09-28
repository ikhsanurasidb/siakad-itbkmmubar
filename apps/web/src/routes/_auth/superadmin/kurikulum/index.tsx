import { createFileRoute } from "@tanstack/react-router";

import CurriculumListPage from "@/components/curriculum-list-page";

const Page = () => (
  <CurriculumListPage
    basePath="/superadmin/kurikulum"
    canManage
    roleName="Superadmin"
  />
);

export const Route = createFileRoute("/_auth/superadmin/kurikulum/")({
  component: Page,
});

import { createFileRoute } from "@tanstack/react-router";

import CurriculumListPage from "@/components/curriculum-list-page";

const Page = () => (
  <CurriculumListPage
    basePath="/kaprodi/kurikulum"
    canManage
    roleName="Kaprodi"
  />
);

export const Route = createFileRoute("/_auth/kaprodi/kurikulum/")({
  component: Page,
});

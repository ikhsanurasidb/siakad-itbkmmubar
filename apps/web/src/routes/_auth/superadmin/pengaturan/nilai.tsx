import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="GRADING"
    description="Atur pembulatan, mata kuliah ulang, dan skala nilai."
    title="Nilai"
  />
);

export const Route = createFileRoute("/_auth/superadmin/pengaturan/nilai")({
  component: Page,
});

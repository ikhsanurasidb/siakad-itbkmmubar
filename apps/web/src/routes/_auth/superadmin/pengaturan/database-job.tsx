import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="BATCH"
    description="Atur batas baris dan ukuran kelompok pada proses impor."
    title="Impor dan proses"
  />
);

export const Route = createFileRoute(
  "/_auth/superadmin/pengaturan/database-job"
)({
  component: Page,
});

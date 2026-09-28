import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="SCHEDULING"
    description="Atur batas waktu perubahan kelas dan jumlah pertemuan daring."
    title="Penjadwalan"
  />
);

export const Route = createFileRoute(
  "/_auth/superadmin/pengaturan/penjadwalan"
)({
  component: Page,
});

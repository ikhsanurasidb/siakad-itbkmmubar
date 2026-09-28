import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="ATTENDANCE"
    description="Atur radius dan jendela waktu presensi luring."
    title="Presensi"
  />
);

export const Route = createFileRoute("/_auth/superadmin/pengaturan/presensi")({
  component: Page,
});

import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="SECURITY"
    description="Atur batas waktu sesi, kata sandi, dan percobaan masuk."
    title="Keamanan"
  />
);

export const Route = createFileRoute("/_auth/superadmin/pengaturan/keamanan")({
  component: Page,
});

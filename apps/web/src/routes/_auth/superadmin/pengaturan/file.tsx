import { createFileRoute } from "@tanstack/react-router";

import SettingsPage from "@/components/settings-page";

const Page = () => (
  <SettingsPage
    category="FILE"
    description="Atur ukuran maksimum dan jenis berkas privat yang diizinkan."
    title="Berkas"
  />
);

export const Route = createFileRoute("/_auth/superadmin/pengaturan/file")({
  component: Page,
});

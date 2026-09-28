import { createFileRoute } from "@tanstack/react-router";

import IdentityAccountsPage from "@/components/identity-accounts-page";

const SuperadminIdentityAccountsPage = () => (
  <IdentityAccountsPage
    description="Kelola seluruh akun identitas dan status provisioning."
    title="Akun identitas"
  />
);

export const Route = createFileRoute("/_auth/superadmin/identitas/akun")({
  component: SuperadminIdentityAccountsPage,
});

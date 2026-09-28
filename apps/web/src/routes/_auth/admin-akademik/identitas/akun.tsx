import { createFileRoute } from "@tanstack/react-router";

import IdentityAccountsPage from "@/components/identity-accounts-page";

const AcademicIdentityAccountsPage = () => (
  <IdentityAccountsPage
    description="Kelola akun Mahasiswa dan Dosen sesuai kewenangan Admin Akademik."
    resettableIdentityTypes={["MAHASISWA", "DOSEN"]}
    title="Akun identitas akademik"
  />
);

export const Route = createFileRoute("/_auth/admin-akademik/identitas/akun")({
  component: AcademicIdentityAccountsPage,
});

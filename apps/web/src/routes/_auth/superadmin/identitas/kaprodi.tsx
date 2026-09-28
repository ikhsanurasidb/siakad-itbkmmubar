import { createFileRoute } from "@tanstack/react-router";

import ProgramHeadsPage from "@/components/program-heads-page";

const SuperadminProgramHeadsPage = () => (
  <ProgramHeadsPage
    description="Kelola penugasan Kaprodi dan periode kewenangan setiap program studi."
    eyebrow="Identitas dan akses · Superadmin"
    title="Penugasan Kaprodi"
  />
);

export const Route = createFileRoute("/_auth/superadmin/identitas/kaprodi")({
  component: SuperadminProgramHeadsPage,
});

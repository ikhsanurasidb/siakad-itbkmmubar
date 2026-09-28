import { createFileRoute } from "@tanstack/react-router";

import ProgramHeadsPage from "@/components/program-heads-page";

const AcademicProgramHeadsPage = () => (
  <ProgramHeadsPage
    description="Tetapkan dan akhiri penugasan Kaprodi berdasarkan Dosen aktif dan periode yang berlaku."
    eyebrow="Identitas dan akses · Admin Akademik"
    title="Penugasan Kaprodi"
  />
);

export const Route = createFileRoute("/_auth/admin-akademik/identitas/kaprodi")(
  {
    component: AcademicProgramHeadsPage,
  }
);

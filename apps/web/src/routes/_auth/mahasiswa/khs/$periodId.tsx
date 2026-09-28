import { createFileRoute } from "@tanstack/react-router";

import { StudentGradesPage } from "@/components/grades-page";

const Page = () => {
  const { periodId } = Route.useParams();
  return <StudentGradesPage periodId={periodId} />;
};

export const Route = createFileRoute("/_auth/mahasiswa/khs/$periodId")({
  component: Page,
});

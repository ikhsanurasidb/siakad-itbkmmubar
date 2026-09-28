import { createFileRoute } from "@tanstack/react-router";

import { StudentGradesPage } from "@/components/grades-page";

const Page = () => <StudentGradesPage />;

export const Route = createFileRoute("/_auth/mahasiswa/transkrip")({
  component: Page,
});

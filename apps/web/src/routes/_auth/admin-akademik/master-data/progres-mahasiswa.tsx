import { createFileRoute } from "@tanstack/react-router";

import StudentProgressPage from "@/components/student-progress-page";

const Page = () => (
  <StudentProgressPage basePath="/admin-akademik/master-data" />
);

export const Route = createFileRoute(
  "/_auth/admin-akademik/master-data/progres-mahasiswa"
)({ component: Page });

import { createFileRoute } from "@tanstack/react-router";

import StudentProgressPage from "@/components/student-progress-page";

const Page = () => <StudentProgressPage basePath="/superadmin/master-data" />;

export const Route = createFileRoute(
  "/_auth/superadmin/master-data/progres-mahasiswa"
)({ component: Page });

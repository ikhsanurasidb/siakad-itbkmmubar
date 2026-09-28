import { createFileRoute } from "@tanstack/react-router";

import AttendancePage from "@/components/attendance-page";

const Page = () => {
  const { classId } = Route.useParams();
  return (
    <AttendancePage
      classSectionId={classId}
      mode="PARTICIPANT"
      roleName="Dosen"
    />
  );
};

export const Route = createFileRoute("/_auth/dosen/kelas/$classId/presensi")({
  component: Page,
});

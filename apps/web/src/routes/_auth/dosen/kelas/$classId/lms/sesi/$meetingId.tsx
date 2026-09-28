import { createFileRoute } from "@tanstack/react-router";

import LmsPage from "@/components/lms-page";

const Page = () => {
  const { classId, meetingId } = Route.useParams();
  return (
    <LmsPage
      classMeetingId={meetingId}
      classSectionId={classId}
      roleName="Dosen"
    />
  );
};

export const Route = createFileRoute(
  "/_auth/dosen/kelas/$classId/lms/sesi/$meetingId"
)({ component: Page });

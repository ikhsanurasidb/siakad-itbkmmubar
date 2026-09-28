import { createFileRoute } from "@tanstack/react-router";

import LmsPage from "@/components/lms-page";

const Page = () => {
  const { classId } = Route.useParams();
  return <LmsPage classSectionId={classId} roleName="Dosen" />;
};

export const Route = createFileRoute("/_auth/dosen/kelas/$classId/lms/")({
  component: Page,
});

import { createFileRoute } from "@tanstack/react-router";

import { GradesClassPage } from "@/components/grades-page";

const Page = () => {
  const { classId } = Route.useParams();
  return <GradesClassPage classSectionId={classId} />;
};

export const Route = createFileRoute("/_auth/dosen/kelas/$classId/nilai")({
  component: Page,
});

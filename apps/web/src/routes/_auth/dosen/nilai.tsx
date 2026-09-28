import { createFileRoute } from "@tanstack/react-router";

import { GradePublicationPage } from "@/components/grades-page";

const Page = () => <GradePublicationPage roleName="Dosen" />;

export const Route = createFileRoute("/_auth/dosen/nilai")({
  component: Page,
});

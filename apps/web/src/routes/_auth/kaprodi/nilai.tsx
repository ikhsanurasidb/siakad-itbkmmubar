import { createFileRoute } from "@tanstack/react-router";

import { GradePublicationPage } from "@/components/grades-page";

const Page = () => <GradePublicationPage roleName="Kaprodi" />;

export const Route = createFileRoute("/_auth/kaprodi/nilai")({
  component: Page,
});

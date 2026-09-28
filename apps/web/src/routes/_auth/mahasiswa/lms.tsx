import { createFileRoute } from "@tanstack/react-router";

import LmsClassListPage from "@/components/lms-class-list-page";

const Page = () => <LmsClassListPage roleName="Mahasiswa" />;

export const Route = createFileRoute("/_auth/mahasiswa/lms")({
  component: Page,
});

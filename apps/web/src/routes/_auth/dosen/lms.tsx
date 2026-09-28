import { createFileRoute } from "@tanstack/react-router";

import LmsClassListPage from "@/components/lms-class-list-page";

const Page = () => <LmsClassListPage roleName="Dosen" />;

export const Route = createFileRoute("/_auth/dosen/lms")({ component: Page });

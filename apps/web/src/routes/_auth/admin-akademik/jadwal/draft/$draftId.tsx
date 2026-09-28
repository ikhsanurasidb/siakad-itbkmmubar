import { createFileRoute } from "@tanstack/react-router";

import SchedulingPage from "@/components/scheduling-page";

const Page = () => <SchedulingPage mode="ADMIN" roleName="Admin Akademik" />;

export const Route = createFileRoute(
  "/_auth/admin-akademik/jadwal/draft/$draftId"
)({
  component: Page,
});

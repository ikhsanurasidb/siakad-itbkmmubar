import { createFileRoute } from "@tanstack/react-router";

import NationalCalendarPage from "@/components/national-calendar-page";

const Page = () => <NationalCalendarPage />;

export const Route = createFileRoute("/_auth/kalender-nasional")({
  component: Page,
});

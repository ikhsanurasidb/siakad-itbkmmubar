import { Outlet, createFileRoute } from "@tanstack/react-router";

const DashboardLayout = () => <Outlet />;

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardLayout,
});

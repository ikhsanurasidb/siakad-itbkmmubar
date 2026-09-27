import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

const RouteComponent = () => {
  const { session } = Route.useRouteContext();

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Ruang kerja
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Selamat datang, {session.data?.user.name}.
        </p>
      </div>
      <Button className="w-fit" variant="outline">
        <LogOut aria-hidden="true" />
        Keluar
      </Button>
    </div>
  );
};

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { client, orpc, queryClient } from "@/utils/orpc";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const revokeOtherSessions = async () => {
  await client.identity.sessions.revokeOthers();
  await queryClient.invalidateQueries({
    queryKey: orpc.identity.sessions.list.queryKey(),
  });
  toast.success("Sesi perangkat lain dicabut.");
};

const SecurityComponent = () => {
  const sessions = useQuery(orpc.identity.sessions.list.queryOptions());

  let sessionContent: React.ReactNode;
  if (sessions.isPending) {
    sessionContent = (
      <p className="text-muted-foreground text-sm">Memuat sesi...</p>
    );
  } else if (sessions.data?.length) {
    sessionContent = (
      <ul className="grid gap-3">
        {sessions.data.map((item) => (
          <li
            className="border-border flex items-start gap-3 border p-3"
            key={item.id}
          >
            {item.isCurrent ? (
              <ShieldCheck
                aria-hidden="true"
                className="text-primary mt-0.5 size-5"
              />
            ) : (
              <MonitorSmartphone
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-5"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {item.isCurrent ? "Perangkat ini" : "Perangkat lain"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {item.userAgent ?? "Perangkat tidak terdeteksi"}
              </p>
              <p className="text-muted-foreground text-xs">
                Aktivitas terakhir {formatDate(item.lastActivityAt)} · IP{" "}
                {item.ipAddress}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  } else {
    sessionContent = (
      <p className="text-muted-foreground text-sm">
        Belum ada sesi yang dapat ditampilkan.
      </p>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Keamanan akun
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Perangkat aktif
        </h1>
        <p className="text-muted-foreground text-sm">
          Tinjau dan cabut sesi yang tidak lagi Anda kenali.
        </p>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Sesi aktif</CardTitle>
            <CardDescription>
              Sesi tidak aktif selama 72 jam akan berakhir otomatis.
            </CardDescription>
          </div>
          <Button onClick={revokeOtherSessions} variant="outline">
            Cabut perangkat lain
          </Button>
        </CardHeader>
        <CardContent>{sessionContent}</CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/_auth/akun/keamanan")({
  component: SecurityComponent,
});

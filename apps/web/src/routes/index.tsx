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
import { Activity, ArrowRight } from "lucide-react";

import { orpc } from "@/utils/orpc";

const getHealthLabel = (isPending: boolean, isHealthy: boolean): string => {
  if (isPending) {
    return "Memeriksa layanan...";
  }

  return isHealthy ? "Layanan tersedia" : "Layanan belum terhubung";
};

const HomeComponent = () => {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <section className="border-border bg-primary text-primary-foreground grid gap-4 border p-6 sm:p-8">
        <p className="text-primary-foreground/70 text-xs font-medium tracking-widest uppercase">
          Portal akademik
        </p>
        <div className="grid gap-2">
          <h1 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Kelola aktivitas akademik dalam satu tempat.
          </h1>
          <p className="text-primary-foreground/80 max-w-2xl text-sm leading-6">
            Fondasi SIAKAD siap digunakan untuk menghubungkan data, akses, dan
            layanan akademik secara teratur.
          </p>
        </div>
        <Button
          className="w-fit"
          render={<a aria-label="Masuk ke sistem" href="/login" />}
          variant="secondary"
        >
          Masuk ke sistem <ArrowRight aria-hidden="true" />
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Status layanan</CardTitle>
          <CardDescription>Pemeriksaan koneksi API platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <Activity
              aria-hidden="true"
              className={
                healthCheck.data ? "text-emerald-600" : "text-muted-foreground"
              }
            />
            <span>
              {getHealthLabel(healthCheck.isPending, Boolean(healthCheck.data))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

import type { StudyPlanGenerationResult } from "@siakad-itbkmmubar/api/study-plan";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { recordText } from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

const StudyPlanGeneratePage = () => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [prodiId, setProdiId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [generationResult, setGenerationResult] =
    useState<StudyPlanGenerationResult | null>(null);
  const periods = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "ACADEMIC_PERIOD", limit: 100, status: "ACTIVE" },
    })
  );
  const generate = useMutation(
    orpc.studyPlan.generate.mutationOptions({
      onError: () =>
        toast.error(
          "KRS belum dapat dibuat. Periksa periode dan data mahasiswa."
        ),
      onSuccess: async (result) => {
        setGenerationResult(result);
        if (result.errorCount > 0) {
          toast.warning(`KRS dibuat dengan ${result.errorCount} kendala.`);
        } else {
          toast.success("KRS draft dibuat.");
        }
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.list.key(),
        });
      },
    })
  );

  const submit = () => {
    setHasSubmitted(true);
    if (!academicPeriodId) {
      return;
    }
    generate.mutate({
      academicPeriodId,
      cohortId: cohortId.trim() || undefined,
      prodiId: prodiId.trim() || undefined,
    });
  };

  if (periods.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
          eyebrow="KRS Paket · Admin Akademik"
          title="Buat KRS Paket"
        />
        <State
          description="Daftar periode akademik sedang dimuat."
          title="Memuat periode"
          variant="loading"
        />
      </div>
    );
  }

  if (periods.isError || !periods.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
          eyebrow="KRS Paket · Admin Akademik"
          title="Buat KRS Paket"
        />
        <State
          action={
            <Button onClick={() => periods.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Periode akademik belum dapat dimuat. Coba lagi atau periksa koneksi."
          title="Periode tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const periodOptions = periods.data.data.filter((period) =>
    recordText(period, "id")
  );
  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Link to="/admin-akademik/krs">
            <Button variant="outline">
              <ArrowLeft aria-hidden="true" />
              Kembali ke KRS
            </Button>
          </Link>
        }
        description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
        eyebrow="KRS Paket · Admin Akademik"
        title="Buat KRS Paket"
      />
      <Card>
        <CardHeader>
          <CardTitle>Parameter pembuatan</CardTitle>
          <CardDescription>
            Mahasiswa aktif akan diproses per kelompok kecil. Mahasiswa tanpa
            kurikulum aktif dicatat sebagai kendala.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <label
            className="grid gap-1.5 text-sm font-medium"
            htmlFor="study-plan-period"
          >
            Periode akademik
            <select
              aria-invalid={hasSubmitted && !academicPeriodId}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              id="study-plan-period"
              onChange={(event) => setAcademicPeriodId(event.target.value)}
              value={academicPeriodId}
            >
              <option value="">Pilih periode</option>
              {periodOptions.map((period) => (
                <option
                  key={recordText(period, "id")}
                  value={recordText(period, "id")}
                >
                  {recordText(period, "term")} ·{" "}
                  {String(period.startDate ?? "").slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-1.5 text-sm font-medium"
            htmlFor="study-plan-prodi"
          >
            ID Prodi (opsional)
            <Input
              id="study-plan-prodi"
              onChange={(event) => setProdiId(event.target.value)}
              placeholder="Kosongkan untuk semua Prodi"
              value={prodiId}
            />
          </label>
          <label
            className="grid gap-1.5 text-sm font-medium"
            htmlFor="study-plan-cohort"
          >
            ID angkatan (opsional)
            <Input
              id="study-plan-cohort"
              onChange={(event) => setCohortId(event.target.value)}
              placeholder="Kosongkan untuk semua angkatan"
              value={cohortId}
            />
          </label>
          <div className="md:col-span-3">
            <Button disabled={generate.isPending} onClick={submit}>
              {generate.isPending ? "Membuat..." : "Buat KRS Paket"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {generationResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Hasil pembuatan KRS</CardTitle>
            <CardDescription>
              {generationResult.processedCount} dari{" "}
              {generationResult.totalCount} mahasiswa diproses ·{" "}
              {generationResult.completedCount} KRS dibuat.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {generationResult.failures.length === 0 ? (
              <p className="text-sm text-[#137a4b]">
                Semua mahasiswa aktif memiliki KRS draft.
              </p>
            ) : (
              <>
                <p className="text-sm text-[#9a5a00]">
                  {generationResult.failures.length} mahasiswa belum dapat
                  dibuatkan KRS.
                </p>
                <ul className="grid gap-2 text-sm text-[#5c6f82]">
                  {generationResult.failures.slice(0, 10).map((failure) => (
                    <li key={failure.studentId}>
                      {failure.nim}: {failure.message}
                    </li>
                  ))}
                </ul>
                {generationResult.failures.length > 10 ? (
                  <p className="text-xs text-[#71859c]">
                    Hanya 10 kendala pertama yang ditampilkan.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default StudyPlanGeneratePage;

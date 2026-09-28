import type { StudyPlanGenerationResult } from "@siakad-itbkmmubar/api/study-plan";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { SearchableSelect } from "@siakad-itbkmmubar/ui/components/searchable-select";
import type { SearchableSelectOption } from "@siakad-itbkmmubar/ui/components/searchable-select";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { recordText } from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

interface StudyPlanGeneratePageProps {
  basePath: "/admin-akademik/krs" | "/superadmin/krs";
  roleName: "Admin Akademik" | "Superadmin";
}

const buildPeriodOptions = (
  rows: readonly Record<string, unknown>[]
): SearchableSelectOption[] =>
  rows.flatMap((period) => {
    const id = recordText(period, "id");
    if (!id) {
      return [];
    }
    const term = recordText(period, "term");
    const startDate = recordText(period, "startDate").slice(0, 10);
    const endDate = recordText(period, "endDate").slice(0, 10);
    return [
      {
        description: [startDate, endDate].filter(Boolean).join(" – "),
        label: `Periode ${term || "akademik"}`,
        value: id,
      },
    ];
  });

const buildProgramOptions = (
  rows: readonly Record<string, unknown>[]
): SearchableSelectOption[] =>
  rows.flatMap((program) => {
    const id = recordText(program, "id");
    const code = recordText(program, "code");
    const name = recordText(program, "name");
    return id && (code || name)
      ? [{ label: [code, name].filter(Boolean).join(" · "), value: id }]
      : [];
  });

const buildCohortOptions = (
  rows: readonly Record<string, unknown>[],
  prodiId: string
): SearchableSelectOption[] =>
  rows
    .filter(
      (cohort) => !prodiId || recordText(cohort, "studyProgramId") === prodiId
    )
    .flatMap((cohort) => {
      const id = recordText(cohort, "id");
      const entryYear = recordText(cohort, "entryYear");
      return id && entryYear
        ? [{ label: `Angkatan ${entryYear}`, value: id }]
        : [];
    });

const StudyPlanGenerationForm = ({
  academicPeriodId,
  canSubmit,
  cohortId,
  cohortOptions,
  isPending,
  onCohortChange,
  onPeriodChange,
  onProdiChange,
  onSubmit,
  periodOptions,
  prodiId,
  prodiOptions,
}: {
  academicPeriodId: string;
  canSubmit: boolean;
  cohortId: string;
  cohortOptions: readonly SearchableSelectOption[];
  isPending: boolean;
  onCohortChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onProdiChange: (value: string) => void;
  onSubmit: () => void;
  periodOptions: readonly SearchableSelectOption[];
  prodiId: string;
  prodiOptions: readonly SearchableSelectOption[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Parameter pembuatan</CardTitle>
      <CardDescription>
        Mahasiswa aktif akan diproses per kelompok kecil. Mahasiswa tanpa
        kurikulum aktif dicatat sebagai kendala.
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-3">
      <SearchableSelect
        id="study-plan-period"
        label="Periode akademik"
        onValueChange={onPeriodChange}
        options={periodOptions}
        placeholder="Cari periode akademik"
        status="ready"
        value={academicPeriodId}
      />
      <SearchableSelect
        id="study-plan-prodi"
        label="Prodi"
        onValueChange={onProdiChange}
        options={prodiOptions}
        optional
        placeholder="Cari Prodi (opsional)"
        status="ready"
        value={prodiId}
      />
      <SearchableSelect
        id="study-plan-cohort"
        label="Angkatan"
        onValueChange={onCohortChange}
        options={cohortOptions}
        optional
        placeholder="Cari angkatan (opsional)"
        status="ready"
        value={cohortId}
      />
      <div className="md:col-span-3">
        <Button disabled={!canSubmit || isPending} onClick={onSubmit}>
          {isPending ? "Membuat..." : "Buat KRS Paket"}
        </Button>
      </div>
    </CardContent>
  </Card>
);

const StudyPlanGenerationResultCard = ({
  result,
}: {
  result: StudyPlanGenerationResult;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Hasil pembuatan KRS</CardTitle>
      <CardDescription>
        {result.processedCount} dari {result.totalCount} mahasiswa diproses ·{" "}
        {result.completedCount} KRS dibuat.
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-3">
      {result.failures.length === 0 ? (
        <p className="text-sm text-[#137a4b]">
          Semua mahasiswa aktif memiliki KRS draft.
        </p>
      ) : (
        <>
          <p className="text-sm text-[#9a5a00]">
            {result.failures.length} mahasiswa belum dapat dibuatkan KRS.
          </p>
          <ul className="grid gap-2 text-sm text-[#5c6f82]">
            {result.failures.slice(0, 10).map((failure) => (
              <li key={failure.studentId}>
                {failure.nim}: {failure.message}
              </li>
            ))}
          </ul>
          {result.failures.length > 10 ? (
            <p className="text-xs text-[#71859c]">
              Hanya 10 kendala pertama yang ditampilkan.
            </p>
          ) : null}
        </>
      )}
    </CardContent>
  </Card>
);

const StudyPlanGeneratePage = ({
  basePath,
  roleName,
}: StudyPlanGeneratePageProps) => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [prodiId, setProdiId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [generationResult, setGenerationResult] =
    useState<StudyPlanGenerationResult | null>(null);
  const periods = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "ACADEMIC_PERIOD", limit: 100, status: "ACTIVE" },
    })
  );
  const studyPrograms = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "STUDY_PROGRAM", limit: 100, status: "ACTIVE" },
    })
  );
  const cohorts = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "COHORT", limit: 100, status: "ACTIVE" },
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

  const periodOptions = buildPeriodOptions(periods.data?.data ?? []);
  const prodiOptions = buildProgramOptions(studyPrograms.data?.data ?? []);
  const cohortOptions = buildCohortOptions(cohorts.data?.data ?? [], prodiId);
  const submit = () => {
    const hasValidPeriod = periodOptions.some(
      (option) => option.value === academicPeriodId
    );
    const hasValidProdi =
      !prodiId || prodiOptions.some((option) => option.value === prodiId);
    const hasValidCohort =
      !cohortId || cohortOptions.some((option) => option.value === cohortId);
    if (!hasValidPeriod || !hasValidProdi || !hasValidCohort) {
      return;
    }
    generate.mutate({
      academicPeriodId,
      cohortId: cohortId || undefined,
      prodiId: prodiId || undefined,
    });
  };
  const canSubmit = periodOptions.some(
    (option) => option.value === academicPeriodId
  );

  const isReferenceLoading =
    periods.isPending || studyPrograms.isPending || cohorts.isPending;
  const isReferenceError =
    periods.isError || studyPrograms.isError || cohorts.isError;

  if (isReferenceLoading) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
          eyebrow={`KRS Paket · ${roleName}`}
          title="Buat KRS Paket"
        />
        <State
          description="Daftar periode, Prodi, dan angkatan sedang dimuat."
          title="Memuat periode"
          variant="loading"
        />
      </div>
    );
  }

  if (
    isReferenceError ||
    !periods.data ||
    !studyPrograms.data ||
    !cohorts.data
  ) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
          eyebrow={`KRS Paket · ${roleName}`}
          title="Buat KRS Paket"
        />
        <State
          action={
            <Button
              onClick={() => {
                periods.refetch();
                studyPrograms.refetch();
                cohorts.refetch();
              }}
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Referensi pembuatan KRS belum dapat dimuat. Coba lagi atau periksa koneksi."
          title="Referensi tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Link to={basePath}>
            <Button variant="outline">
              <ArrowLeft aria-hidden="true" />
              Kembali ke KRS
            </Button>
          </Link>
        }
        description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
        eyebrow={`KRS Paket · ${roleName}`}
        title="Buat KRS Paket"
      />
      <StudyPlanGenerationForm
        academicPeriodId={academicPeriodId}
        canSubmit={canSubmit}
        cohortId={cohortId}
        cohortOptions={cohortOptions}
        isPending={generate.isPending}
        onCohortChange={setCohortId}
        onPeriodChange={setAcademicPeriodId}
        onProdiChange={(value) => {
          setProdiId(value);
          setCohortId("");
        }}
        onSubmit={submit}
        periodOptions={periodOptions}
        prodiId={prodiId}
        prodiOptions={prodiOptions}
      />
      {generationResult ? (
        <StudyPlanGenerationResultCard result={generationResult} />
      ) : null}
    </div>
  );
};

export default StudyPlanGeneratePage;

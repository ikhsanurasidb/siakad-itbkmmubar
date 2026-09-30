import { formatAcademicPeriodLabel } from "@siakad-itbkmmubar/api/master-data";
import type {
  StudentSemesterTrackerRecord,
  StudyPlanGenerationResult,
} from "@siakad-itbkmmubar/api/study-plan";
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
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { recordText } from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

interface StudyPlanGeneratePageProps {
  basePath: "/admin-akademik/krs" | "/superadmin/krs";
  roleName: "Admin Akademik" | "Superadmin";
}

interface StudyPlanGenerationInput {
  academicPeriodId: string;
  cohortId?: string;
  idempotencyKey: string;
  prodiId?: string;
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
    const academicYear = recordText(period, "academicYearLabel");
    const startDate = recordText(period, "startDate").slice(0, 10);
    const endDate = recordText(period, "endDate").slice(0, 10);
    return [
      {
        description: [startDate, endDate].filter(Boolean).join(" – "),
        label: formatAcademicPeriodLabel(term || "akademik", academicYear),
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

const hasValidGenerationFilters = ({
  academicPeriodId,
  cohortId,
  cohortOptions,
  prodiId,
  prodiOptions,
  periodOptions,
}: {
  academicPeriodId: string;
  cohortId: string;
  cohortOptions: readonly SearchableSelectOption[];
  prodiId: string;
  prodiOptions: readonly SearchableSelectOption[];
  periodOptions: readonly SearchableSelectOption[];
}): boolean =>
  periodOptions.some((option) => option.value === academicPeriodId) &&
  (!prodiId || prodiOptions.some((option) => option.value === prodiId)) &&
  (!cohortId || cohortOptions.some((option) => option.value === cohortId));

const getUpdatingStudentId = ({
  isPending,
  studentId,
}: {
  isPending: boolean;
  studentId?: string;
}): string | null => (isPending ? (studentId ?? null) : null);

const notifyGenerationResult = (result: StudyPlanGenerationResult): void => {
  if (result.errorCount > 0) {
    const [firstFailure] = result.failures;
    toast.warning(
      firstFailure
        ? `${result.errorCount} kendala. ${firstFailure.action}`
        : `KRS dibuat dengan ${result.errorCount} kendala.`
    );
    return;
  }
  toast.success("KRS draft dibuat.");
};

const submitStudyPlanGeneration = ({
  academicPeriodId,
  cohortId,
  cohortOptions,
  onGenerate,
  periodOptions,
  prodiId,
  prodiOptions,
}: {
  academicPeriodId: string;
  cohortId: string;
  cohortOptions: readonly SearchableSelectOption[];
  onGenerate: (input: StudyPlanGenerationInput) => void;
  periodOptions: readonly SearchableSelectOption[];
  prodiId: string;
  prodiOptions: readonly SearchableSelectOption[];
}): void => {
  if (
    !hasValidGenerationFilters({
      academicPeriodId,
      cohortId,
      cohortOptions,
      periodOptions,
      prodiId,
      prodiOptions,
    })
  ) {
    return;
  }
  onGenerate({
    academicPeriodId,
    cohortId: cohortId || undefined,
    idempotencyKey: createUuidV7(),
    prodiId: prodiId || undefined,
  });
};

const areReferenceDataUnavailable = ({
  hasCohorts,
  hasPeriods,
  hasPrograms,
  isError,
  isLoading,
}: {
  hasCohorts: boolean;
  hasPeriods: boolean;
  hasPrograms: boolean;
  isError: boolean;
  isLoading: boolean;
}): boolean =>
  isLoading || isError || !hasPeriods || !hasPrograms || !hasCohorts;

const StudyPlanReferenceState = ({
  isLoading,
  onRetry,
  roleName,
}: {
  isLoading: boolean;
  onRetry: () => void;
  roleName: "Admin Akademik" | "Superadmin";
}) => {
  if (isLoading) {
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
  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Buat KRS Paket berdasarkan periode, Prodi, dan angkatan aktif."
        eyebrow={`KRS Paket · ${roleName}`}
        title="Buat KRS Paket"
      />
      <State
        action={
          <Button onClick={onRetry} variant="outline">
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
};

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
        Mahasiswa aktif akan diproses per kelompok kecil. Mahasiswa tanpa data
        kurikulum yang siap digunakan akan dicatat dengan langkah perbaikannya.
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
                <p>
                  <span className="font-medium">{failure.nim}</span>:{" "}
                  {failure.message}
                </p>
                <p className="mt-1 text-xs text-[#5c6f82]">
                  Tindakan: {failure.action}
                </p>
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

const SemesterTrackerCard = ({
  isError,
  isPending,
  onRetry,
  onUpdate,
  periodSelected,
  rows,
  updatingStudentId,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onUpdate: (studentId: string, semesterNumber: number) => void;
  periodSelected: boolean;
  rows: readonly StudentSemesterTrackerRecord[];
  updatingStudentId: string | null;
}) => {
  let content: ReactNode;
  if (!periodSelected) {
    content = (
      <p className="text-sm text-[#5c6f82]">
        Pilih periode akademik untuk melihat semester berjalan mahasiswa.
      </p>
    );
  } else if (isPending) {
    content = (
      <p className="text-sm text-[#5c6f82]">Memuat tracker semester...</p>
    );
  } else if (isError) {
    content = (
      <div className="grid gap-2">
        <p className="text-sm text-[#9b2c2c]">
          Tracker semester belum dapat dimuat.
        </p>
        <Button onClick={onRetry} variant="outline">
          Coba lagi
        </Button>
      </div>
    );
  } else if (rows.length === 0) {
    content = (
      <p className="text-sm text-[#5c6f82]">
        Tidak ada mahasiswa aktif pada filter yang dipilih.
      </p>
    );
  } else {
    content = (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#dbe5ee] text-[#5c6f82]">
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                NIM
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Nama
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Angkatan
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Semester berjalan
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Sumber
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-[#edf2f7]" key={row.student.id}>
                <td className="px-3 py-2 font-medium">{row.student.nim}</td>
                <td className="px-3 py-2">{row.student.name}</td>
                <td className="px-3 py-2">{row.entryYear}</td>
                <td className="px-3 py-2">
                  <label
                    className="sr-only"
                    htmlFor={`semester-${row.student.id}`}
                  >
                    Semester berjalan {row.student.nim}
                  </label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    disabled={updatingStudentId === row.student.id}
                    id={`semester-${row.student.id}`}
                    onChange={(event) => {
                      const semesterNumber = Number(event.target.value);
                      if (Number.isInteger(semesterNumber)) {
                        onUpdate(row.student.id, semesterNumber);
                      }
                    }}
                    value={row.semesterNumber ?? ""}
                  >
                    <option value="">Belum ditentukan</option>
                    {Array.from({ length: 8 }, (_, index) => index + 1).map(
                      (semesterNumber) => (
                        <option key={semesterNumber} value={semesterNumber}>
                          Semester {semesterNumber}
                        </option>
                      )
                    )}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {row.source === "MANUAL" ? "Manual" : "Otomatis"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracker semester mahasiswa</CardTitle>
        <CardDescription>
          Semester dihitung otomatis dari angkatan dan tahun akademik. Koreksi
          manual akan dipakai sebagai acuan pembuatan KRS untuk periode ini.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

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
  const semesterTrackers = useQuery(
    orpc.studyPlan.listSemesterTrackers.queryOptions({
      enabled: Boolean(academicPeriodId),
      input: {
        academicPeriodId,
        cohortId: cohortId || undefined,
        prodiId: prodiId || undefined,
      },
    })
  );
  const updateSemesterTracker = useMutation(
    orpc.studyPlan.updateSemesterTracker.mutationOptions({
      onError: () => toast.error("Semester berjalan belum dapat disimpan."),
      onSuccess: async () => {
        toast.success("Semester berjalan berhasil diperbarui.");
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.listSemesterTrackers.key(),
        });
      },
    })
  );
  const generate = useMutation(
    orpc.studyPlan.generate.mutationOptions({
      onError: () =>
        toast.error(
          "Pembuatan KRS gagal dijalankan. Periksa periode aktif, kurikulum Prodi–angkatan, dan mata kuliahnya."
        ),
      onSuccess: async (result) => {
        setGenerationResult(result);
        notifyGenerationResult(result);
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.list.key(),
        });
      },
    })
  );

  const periodOptions = buildPeriodOptions(periods.data?.data ?? []);
  const prodiOptions = buildProgramOptions(studyPrograms.data?.data ?? []);
  const cohortOptions = buildCohortOptions(cohorts.data?.data ?? [], prodiId);
  const submit = () =>
    submitStudyPlanGeneration({
      academicPeriodId,
      cohortId,
      cohortOptions,
      onGenerate: (input) => generate.mutate(input),
      periodOptions,
      prodiId,
      prodiOptions,
    });
  const canSubmit = periodOptions.some(
    (option) => option.value === academicPeriodId
  );

  const isReferenceLoading =
    periods.isPending || studyPrograms.isPending || cohorts.isPending;
  const isReferenceError =
    periods.isError || studyPrograms.isError || cohorts.isError;

  if (
    areReferenceDataUnavailable({
      hasCohorts: Boolean(cohorts.data),
      hasPeriods: Boolean(periods.data),
      hasPrograms: Boolean(studyPrograms.data),
      isError: isReferenceError,
      isLoading: isReferenceLoading,
    })
  ) {
    return (
      <StudyPlanReferenceState
        isLoading={isReferenceLoading}
        onRetry={() => {
          periods.refetch();
          studyPrograms.refetch();
          cohorts.refetch();
        }}
        roleName={roleName}
      />
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
      <SemesterTrackerCard
        isError={semesterTrackers.isError}
        isPending={semesterTrackers.isPending}
        onRetry={() => semesterTrackers.refetch()}
        onUpdate={(studentId, semesterNumber) =>
          updateSemesterTracker.mutate({
            academicPeriodId,
            semesterNumber,
            studentId,
          })
        }
        periodSelected={Boolean(academicPeriodId)}
        rows={semesterTrackers.data ?? []}
        updatingStudentId={getUpdatingStudentId({
          isPending: updateSemesterTracker.isPending,
          studentId: updateSemesterTracker.variables?.studentId,
        })}
      />
      {generationResult ? (
        <StudyPlanGenerationResultCard result={generationResult} />
      ) : null}
    </div>
  );
};

export default StudyPlanGeneratePage;

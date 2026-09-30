import { formatAcademicPeriodLabel } from "@siakad-itbkmmubar/api/master-data";
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

import StudentSemesterTrackerCard from "@/components/student-semester-tracker-card";
import { recordText } from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

interface StudentProgressPageProps {
  basePath: "/admin-akademik/master-data" | "/superadmin/master-data";
}

const buildPeriodOptions = (
  rows: readonly Record<string, unknown>[]
): SearchableSelectOption[] =>
  rows.flatMap((period) => {
    const id = recordText(period, "id");
    const term = recordText(period, "term");
    const academicYear = recordText(period, "academicYearLabel");
    const startDate = recordText(period, "startDate").slice(0, 10);
    const endDate = recordText(period, "endDate").slice(0, 10);
    return id
      ? [
          {
            description: [startDate, endDate].filter(Boolean).join(" – "),
            label: formatAcademicPeriodLabel(term || "akademik", academicYear),
            value: id,
          },
        ]
      : [];
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

// eslint-disable-next-line complexity -- page coordinates reference data, filters, and tracker mutations.
const StudentProgressPage = ({ basePath }: StudentProgressPageProps) => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [prodiId, setProdiId] = useState("");
  const [cohortId, setCohortId] = useState("");
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
  const periodOptions = buildPeriodOptions(periods.data?.data ?? []);
  const selectedPeriodId = academicPeriodId || periodOptions[0]?.value || "";
  const prodiOptions = buildProgramOptions(studyPrograms.data?.data ?? []);
  const cohortOptions = buildCohortOptions(cohorts.data?.data ?? [], prodiId);
  const semesterTrackers = useQuery(
    orpc.studyPlan.listSemesterTrackers.queryOptions({
      enabled: Boolean(selectedPeriodId),
      input: {
        academicPeriodId: selectedPeriodId,
        cohortId: cohortId || undefined,
        includeInactive: true,
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
  const isReferenceLoading =
    periods.isPending || studyPrograms.isPending || cohorts.isPending;
  const isReferenceError =
    periods.isError || studyPrograms.isError || cohorts.isError;

  if (isReferenceLoading || isReferenceError) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          action={
            <Link to={basePath}>
              <Button variant="outline">
                <ArrowLeft aria-hidden="true" />
                Kembali
              </Button>
            </Link>
          }
          description="Kelola semester berjalan mahasiswa untuk seluruh proses akademik."
          eyebrow="Data master"
          title="Progress mahasiswa"
        />
        <State
          action={
            isReferenceError ? (
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
            ) : undefined
          }
          description={
            isReferenceError
              ? "Periode, Prodi, atau angkatan belum dapat dimuat."
              : "Periode dan referensi mahasiswa sedang dimuat."
          }
          title={isReferenceError ? "Referensi tidak tersedia" : "Memuat data"}
          variant={isReferenceError ? "error" : "loading"}
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
              Kembali
            </Button>
          </Link>
        }
        description="Kelola semester berjalan mahasiswa untuk seluruh proses akademik."
        eyebrow="Data master"
        title="Progress mahasiswa"
      />
      <Card>
        <CardHeader>
          <CardTitle>Parameter tracker</CardTitle>
          <CardDescription>
            Pilih periode untuk meninjau semester berjalan. Nilai manual di
            halaman ini juga digunakan saat pembuatan KRS.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <SearchableSelect
            id="student-progress-period"
            label="Periode akademik"
            onValueChange={setAcademicPeriodId}
            options={periodOptions}
            placeholder="Cari periode akademik"
            status="ready"
            value={selectedPeriodId}
          />
          <SearchableSelect
            id="student-progress-prodi"
            label="Prodi"
            onValueChange={(value) => {
              setProdiId(value);
              setCohortId("");
            }}
            options={prodiOptions}
            optional
            placeholder="Semua Prodi"
            status="ready"
            value={prodiId}
          />
          <SearchableSelect
            id="student-progress-cohort"
            label="Angkatan"
            onValueChange={setCohortId}
            options={cohortOptions}
            optional
            placeholder="Semua angkatan"
            status="ready"
            value={cohortId}
          />
        </CardContent>
      </Card>
      <StudentSemesterTrackerCard
        isError={semesterTrackers.isError}
        isPending={semesterTrackers.isPending}
        onRetry={() => semesterTrackers.refetch()}
        onUpdate={(studentId, semesterNumber) =>
          updateSemesterTracker.mutate({
            academicPeriodId: selectedPeriodId,
            semesterNumber,
            studentId,
          })
        }
        periodSelected={Boolean(selectedPeriodId)}
        rows={semesterTrackers.data ?? []}
        updatingStudentId={
          updateSemesterTracker.isPending
            ? (updateSemesterTracker.variables?.studentId ?? null)
            : null
        }
      />
    </div>
  );
};

export default StudentProgressPage;

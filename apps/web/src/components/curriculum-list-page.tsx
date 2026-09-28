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
import { ArrowRight, BookOpen, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  curriculumStatusClassNames,
  curriculumStatusLabels,
  formatCurriculumDate,
  curriculumRoutePaths,
  recordText,
} from "@/components/curriculum-ui";
import type { CurriculumBasePath } from "@/components/curriculum-ui";
import { orpc } from "@/utils/orpc";

interface CurriculumListPageProps {
  basePath: CurriculumBasePath;
  canManage: boolean;
  roleName: string;
}

const getErrorMessage = (): string =>
  "Kurikulum belum dapat diproses. Periksa data lalu coba lagi.";

const CurriculumListPage = ({
  basePath,
  canManage,
  roleName,
}: CurriculumListPageProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const curriculum = useQuery(
    orpc.curriculum.list.queryOptions({ input: { status: undefined } })
  );
  const studyPrograms = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: canManage,
      input: { entityType: "STUDY_PROGRAM", limit: 100, status: "ACTIVE" },
    })
  );
  const cohorts = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: canManage,
      input: { entityType: "COHORT", limit: 100, status: "ACTIVE" },
    })
  );
  const createCurriculum = useMutation(
    orpc.curriculum.create.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async ({ id }) => {
        setName("");
        setStudyProgramId("");
        setCohortId("");
        setHasSubmitted(false);
        toast.success("Draft kurikulum dibuat.");
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.list.key(),
        });
        window.location.assign(`${basePath}/${id}`);
      },
    })
  );

  const selectedProgramId = studyProgramId;
  const studyProgramOptions = (studyPrograms.data?.data ?? []).filter(
    (row) => recordText(row, "id") && recordText(row, "name")
  );
  const cohortOptions = (cohorts.data?.data ?? []).filter(
    (row) =>
      recordText(row, "id") &&
      recordText(row, "entryYear") &&
      recordText(row, "studyProgramId") === selectedProgramId
  );
  const submitCreate = () => {
    setHasSubmitted(true);
    if (!name.trim() || !studyProgramId || !cohortId) {
      return;
    }
    createCurriculum.mutate({ cohortId, name: name.trim(), studyProgramId });
  };
  const detailRoute = curriculumRoutePaths[basePath].detail;

  if (curriculum.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Susun kurikulum per Prodi dan angkatan untuk menjadi acuan akademik."
          eyebrow={`Kurikulum · ${roleName}`}
          title="Kurikulum"
        />
        <State
          description="Daftar kurikulum sedang dimuat."
          title="Memuat kurikulum"
          variant="loading"
        />
      </div>
    );
  }

  if (curriculum.isError || !curriculum.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Susun kurikulum per Prodi dan angkatan untuk menjadi acuan akademik."
          eyebrow={`Kurikulum · ${roleName}`}
          title="Kurikulum"
        />
        <State
          action={
            <Button onClick={() => curriculum.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Daftar kurikulum belum dapat dimuat. Coba lagi atau periksa koneksi."
          title="Kurikulum tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Susun kurikulum per Prodi dan angkatan untuk menjadi acuan akademik."
        eyebrow={`Kurikulum · ${roleName}`}
        title="Kurikulum"
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Buat kurikulum</CardTitle>
            <CardDescription>
              Draft baru dapat diisi struktur mata kuliah dan komponen nilai.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <label
              className="grid gap-1.5 text-sm font-medium"
              htmlFor="curriculum-name"
            >
              Nama kurikulum
              <Input
                aria-invalid={hasSubmitted && !name.trim()}
                id="curriculum-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Kurikulum 2026"
                value={name}
              />
            </label>
            <label
              className="grid gap-1.5 text-sm font-medium"
              htmlFor="curriculum-program"
            >
              Prodi
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                id="curriculum-program"
                onChange={(event) => {
                  setStudyProgramId(event.target.value);
                  setCohortId("");
                }}
                value={studyProgramId}
              >
                <option value="">Pilih Prodi</option>
                {studyProgramOptions.map((row) => (
                  <option
                    key={recordText(row, "id")}
                    value={recordText(row, "id")}
                  >
                    {recordText(row, "code")} · {recordText(row, "name")}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="grid gap-1.5 text-sm font-medium"
              htmlFor="curriculum-cohort"
            >
              Angkatan
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                disabled={!studyProgramId}
                id="curriculum-cohort"
                onChange={(event) => setCohortId(event.target.value)}
                value={cohortId}
              >
                <option value="">Pilih angkatan</option>
                {cohortOptions.map((row) => (
                  <option
                    key={recordText(row, "id")}
                    value={recordText(row, "id")}
                  >
                    Angkatan {recordText(row, "entryYear")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end md:col-span-3">
              <Button
                disabled={createCurriculum.isPending}
                onClick={submitCreate}
              >
                <Plus aria-hidden="true" />
                {createCurriculum.isPending ? "Membuat..." : "Buat draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {curriculum.data.length === 0 ? (
        <Card>
          <State
            description={
              canManage
                ? "Buat draft untuk mulai menyusun struktur mata kuliah."
                : "Belum ada kurikulum yang dapat ditampilkan."
            }
            title="Belum ada kurikulum"
            variant="not-found"
          />
        </Card>
      ) : (
        <section
          aria-label="Daftar kurikulum"
          className="grid gap-4 md:grid-cols-2"
        >
          {curriculum.data.map((item) => (
            <Card className="group border-[#dbe5ee]" key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0b63b6]">
                    <BookOpen aria-hidden="true" className="size-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${curriculumStatusClassNames[item.status]}`}
                  >
                    {curriculumStatusLabels[item.status]}
                  </span>
                </div>
                <div className="grid gap-1">
                  <CardTitle>{item.name}</CardTitle>
                  <CardDescription>
                    {item.studyProgram.code} · {item.studyProgram.name} ·
                    Angkatan {item.cohort.entryYear}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#71859c]">
                  {item.courseCount} mata kuliah · Diperbarui{" "}
                  {formatCurriculumDate.format(new Date(item.updatedAt))}
                </p>
                <Link
                  aria-label={`Buka kurikulum ${item.name}`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#0b63b6] transition group-hover:gap-2"
                  params={{ curriculumId: item.id }}
                  to={detailRoute}
                >
                  Lihat kurikulum
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default CurriculumListPage;

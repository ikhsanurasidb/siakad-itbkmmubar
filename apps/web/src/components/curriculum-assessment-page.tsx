import type { CurriculumAssessmentComponent } from "@siakad-itbkmmubar/api/curriculum";
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
import { ArrowLeft, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { curriculumRoutePaths } from "@/components/curriculum-ui";
import type { CurriculumBasePath } from "@/components/curriculum-ui";
import { orpc } from "@/utils/orpc";

interface CurriculumAssessmentPageProps {
  basePath: CurriculumBasePath;
  canManage: boolean;
  curriculumId: string;
  roleName: string;
}

interface AssessmentRow {
  components: CurriculumAssessmentComponent[];
  curriculumCourseId: string;
}

const CurriculumAssessmentPage = ({
  basePath,
  canManage,
  curriculumId,
  roleName,
}: CurriculumAssessmentPageProps) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    curriculumId: string;
    rows: AssessmentRow[];
  }>();
  const detail = useQuery(
    orpc.curriculum.detail.queryOptions({ input: { curriculumId } })
  );
  const replaceAssessments = useMutation(
    orpc.curriculum.assessments.replace.mutationOptions({
      onError: () => toast.error("Komponen nilai belum dapat disimpan."),
      onSuccess: async () => {
        toast.success("Komponen nilai disimpan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.detail.key(),
        });
      },
    })
  );

  if (detail.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <State
          description="Komponen nilai sedang dimuat."
          title="Memuat komponen nilai"
          variant="loading"
        />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <State
          action={
            <Button onClick={() => detail.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Komponen nilai belum dapat dimuat."
          title="Kurikulum tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const curriculum = detail.data;
  const detailRoute = curriculumRoutePaths[basePath].detail;
  const initialRows = curriculum.assessments.map((assessment) => ({
    components: assessment.components.map((component) => ({ ...component })),
    curriculumCourseId: assessment.curriculumCourseId,
  }));
  const rows = draft?.curriculumId === curriculumId ? draft.rows : initialRows;
  const updateRows = (
    updater: (current: AssessmentRow[]) => AssessmentRow[]
  ) => {
    setDraft((current) => ({
      curriculumId,
      rows: updater(
        current?.curriculumId === curriculumId ? current.rows : initialRows
      ),
    }));
  };
  const updateComponent = (
    courseId: string,
    index: number,
    patch: Partial<CurriculumAssessmentComponent>
  ) => {
    updateRows((current) =>
      current.map((row) =>
        row.curriculumCourseId === courseId
          ? {
              ...row,
              components: row.components.map((component, componentIndex) =>
                componentIndex === index
                  ? { ...component, ...patch }
                  : component
              ),
            }
          : row
      )
    );
  };
  const addComponent = (courseId: string) => {
    updateRows((current) =>
      current.map((row) =>
        row.curriculumCourseId === courseId
          ? {
              ...row,
              components: [
                ...row.components,
                {
                  componentCode: `KOMPONEN_${row.components.length + 1}`,
                  label: "Komponen baru",
                  weight: 0,
                },
              ],
            }
          : row
      )
    );
  };
  const removeComponent = (courseId: string, index: number) => {
    updateRows((current) =>
      current.map((row) =>
        row.curriculumCourseId === courseId
          ? {
              ...row,
              components: row.components.filter(
                (_, componentIndex) => componentIndex !== index
              ),
            }
          : row
      )
    );
  };
  const save = () => {
    if (!canManage || curriculum.status !== "DRAFT") {
      return;
    }
    replaceAssessments.mutate({ curriculumId, overrides: rows });
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Link params={{ curriculumId }} to={detailRoute}>
            <Button variant="outline">
              <ArrowLeft aria-hidden="true" />
              Kembali ke detail
            </Button>
          </Link>
        }
        description={`${curriculum.name} · Nilai bawaan dapat dioverride untuk kurikulum ini.`}
        eyebrow={`Kurikulum · ${roleName}`}
        title="Komponen nilai"
      />
      <Card>
        <CardHeader>
          <CardTitle>Bobot penilaian per mata kuliah</CardTitle>
          <CardDescription>
            Draft boleh memiliki total bobot di bawah 100%. Total harus tepat
            100% sebelum aktivasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {rows.length === 0 ? (
            <State
              description="Isi struktur mata kuliah terlebih dahulu."
              title="Belum ada mata kuliah"
              variant="not-found"
            />
          ) : (
            rows.map((row) => {
              const course = curriculum.courses.find(
                (item) => item.id === row.curriculumCourseId
              );
              const total = row.components.reduce(
                (sum, component) => sum + component.weight,
                0
              );
              return (
                <section
                  className="grid gap-3 rounded-2xl border border-[#dbe5ee] p-4"
                  key={row.curriculumCourseId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-[#102d4d]">
                        {course?.courseCode} · {course?.courseName}
                      </h2>
                      <p className="text-sm text-[#71859c]">
                        Semester {course?.semester} · Total bobot {total}%
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${total === 100 ? "bg-[#e7f7ef] text-[#137a4b]" : "bg-[#fff2df] text-[#9a5a00]"}`}
                    >
                      {total === 100 ? "Lengkap" : "Belum 100%"}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {row.components.map((component, index) => (
                      <div
                        className="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)_7rem_auto]"
                        key={`${row.curriculumCourseId}-${index}`}
                      >
                        <Input
                          aria-label={`Kode komponen ${index + 1}`}
                          disabled={!canManage || curriculum.status !== "DRAFT"}
                          onChange={(event) =>
                            updateComponent(row.curriculumCourseId, index, {
                              componentCode: event.target.value.toUpperCase(),
                            })
                          }
                          placeholder="Kode"
                          value={component.componentCode}
                        />
                        <Input
                          aria-label={`Nama komponen ${index + 1}`}
                          disabled={!canManage || curriculum.status !== "DRAFT"}
                          onChange={(event) =>
                            updateComponent(row.curriculumCourseId, index, {
                              label: event.target.value,
                            })
                          }
                          placeholder="Nama komponen"
                          value={component.label}
                        />
                        <Input
                          aria-label={`Bobot komponen ${index + 1}`}
                          disabled={!canManage || curriculum.status !== "DRAFT"}
                          max={100}
                          min={0}
                          onChange={(event) =>
                            updateComponent(row.curriculumCourseId, index, {
                              weight: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={component.weight}
                        />
                        {canManage && curriculum.status === "DRAFT" ? (
                          <Button
                            aria-label={`Hapus komponen ${index + 1}`}
                            onClick={() =>
                              removeComponent(row.curriculumCourseId, index)
                            }
                            size="icon"
                            variant="outline"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {canManage && curriculum.status === "DRAFT" ? (
                    <Button
                      className="justify-self-start"
                      onClick={() => addComponent(row.curriculumCourseId)}
                      variant="outline"
                    >
                      <Plus aria-hidden="true" />
                      Tambah komponen
                    </Button>
                  ) : null}
                </section>
              );
            })
          )}
          {canManage && curriculum.status === "DRAFT" ? (
            <div className="flex justify-end">
              <Button disabled={replaceAssessments.isPending} onClick={save}>
                {replaceAssessments.isPending
                  ? "Menyimpan..."
                  : "Simpan komponen nilai"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default CurriculumAssessmentPage;

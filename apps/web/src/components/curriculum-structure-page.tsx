import type { CurriculumCourseType } from "@siakad-itbkmmubar/api/curriculum";
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

import { curriculumRoutePaths, recordText } from "@/components/curriculum-ui";
import type { CurriculumBasePath } from "@/components/curriculum-ui";
import { orpc } from "@/utils/orpc";

interface CurriculumStructurePageProps {
  basePath: CurriculumBasePath;
  canManage: boolean;
  curriculumId: string;
  roleName: string;
}

interface StructureRow {
  courseId: string;
  courseType: CurriculumCourseType;
  id: string;
  semester: number;
}

const CurriculumStructurePage = ({
  basePath,
  canManage,
  curriculumId,
  roleName,
}: CurriculumStructurePageProps) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    curriculumId: string;
    rows: StructureRow[];
  }>();
  const detail = useQuery(
    orpc.curriculum.detail.queryOptions({ input: { curriculumId } })
  );
  const courseOptions = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: Boolean(detail.data),
      input: { entityType: "COURSE", limit: 100, status: "ACTIVE" },
    })
  );
  const replaceStructure = useMutation(
    orpc.curriculum.structure.replace.mutationOptions({
      onError: () => toast.error("Struktur belum dapat disimpan."),
      onSuccess: async () => {
        toast.success("Struktur kurikulum disimpan.");
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
          description="Struktur mata kuliah sedang dimuat."
          title="Memuat struktur"
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
          description="Struktur kurikulum belum dapat dimuat."
          title="Kurikulum tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const curriculum = detail.data;
  const detailRoute = curriculumRoutePaths[basePath].detail;
  const initialRows = curriculum.courses.map((course) => ({
    courseId: course.courseId,
    courseType: course.courseType,
    id: course.id,
    semester: course.semester,
  }));
  const rows = draft?.curriculumId === curriculumId ? draft.rows : initialRows;
  const updateRows = (updater: (current: StructureRow[]) => StructureRow[]) => {
    setDraft((current) => ({
      curriculumId,
      rows: updater(
        current?.curriculumId === curriculumId ? current.rows : initialRows
      ),
    }));
  };
  const availableCourses = (courseOptions.data?.data ?? []).filter(
    (course) =>
      recordText(course, "studyProgramId") === curriculum.studyProgram.id
  );
  const courseLabel = (courseId: string): string => {
    const course = availableCourses.find(
      (option) => recordText(option, "id") === courseId
    );
    if (course) {
      return `${recordText(course, "code")} · ${recordText(course, "name")}`;
    }
    const current = curriculum.courses.find(
      (option) => option.courseId === courseId
    );
    return current ? `${current.courseCode} · ${current.courseName}` : courseId;
  };
  const updateRow = (id: string, patch: Partial<StructureRow>) => {
    updateRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };
  const addRow = () => {
    const courseId = availableCourses.find(
      (course) => !rows.some((row) => row.courseId === recordText(course, "id"))
    );
    if (!courseId) {
      toast.error("Tidak ada mata kuliah aktif lain pada Prodi ini.");
      return;
    }
    updateRows((current) => [
      ...current,
      {
        courseId: recordText(courseId, "id"),
        courseType: "REQUIRED",
        id: crypto.randomUUID(),
        semester: 1,
      },
    ]);
  };
  const save = () => {
    if (!canManage || curriculum.status !== "DRAFT") {
      return;
    }
    replaceStructure.mutate({
      courses: rows.map(({ courseId, courseType, semester }) => ({
        courseId,
        courseType,
        semester,
      })),
      curriculumId,
    });
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
        description={`${curriculum.name} · ${curriculum.studyProgram.code} · ${curriculum.cohort.entryYear}`}
        eyebrow={`Kurikulum · ${roleName}`}
        title="Struktur kurikulum"
      />
      <Card>
        <CardHeader>
          <CardTitle>Mata kuliah semester 1–8</CardTitle>
          <CardDescription>
            Setiap mata kuliah hanya dapat dicantumkan satu kali dalam
            kurikulum.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length === 0 ? (
            <State
              description={
                canManage && curriculum.status === "DRAFT"
                  ? "Tambahkan mata kuliah untuk mulai menyusun semester."
                  : "Belum ada struktur mata kuliah."
              }
              title="Struktur masih kosong"
              variant="not-found"
            />
          ) : (
            rows.map((row, index) => (
              <div
                className="grid gap-2 rounded-xl border border-[#dbe5ee] p-3 md:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] md:items-end"
                key={row.id}
              >
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor={`course-${row.id}`}
                >
                  Mata kuliah {index + 1}
                  {canManage && curriculum.status === "DRAFT" ? (
                    <select
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                      id={`course-${row.id}`}
                      onChange={(event) =>
                        updateRow(row.id, { courseId: event.target.value })
                      }
                      value={row.courseId}
                    >
                      {availableCourses.map((course) => (
                        <option
                          key={recordText(course, "id")}
                          value={recordText(course, "id")}
                        >
                          {recordText(course, "code")} ·{" "}
                          {recordText(course, "name")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-md border border-[#dbe5ee] px-3 py-2 text-sm font-normal">
                      {courseLabel(row.courseId)}
                    </span>
                  )}
                </label>
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor={`semester-${row.id}`}
                >
                  Semester
                  <Input
                    disabled={!canManage || curriculum.status !== "DRAFT"}
                    id={`semester-${row.id}`}
                    max={8}
                    min={1}
                    onChange={(event) =>
                      updateRow(row.id, {
                        semester: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={row.semester}
                  />
                </label>
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor={`type-${row.id}`}
                >
                  Jenis
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    disabled={!canManage || curriculum.status !== "DRAFT"}
                    id={`type-${row.id}`}
                    onChange={(event) =>
                      updateRow(row.id, {
                        courseType: event.target.value as CurriculumCourseType,
                      })
                    }
                    value={row.courseType}
                  >
                    <option value="REQUIRED">Wajib</option>
                    <option value="ELECTIVE">Pilihan</option>
                  </select>
                </label>
                {canManage && curriculum.status === "DRAFT" ? (
                  <Button
                    aria-label={`Hapus mata kuliah ${index + 1}`}
                    onClick={() =>
                      updateRows((current) =>
                        current.filter((item) => item.id !== row.id)
                      )
                    }
                    size="icon"
                    variant="outline"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
          {canManage && curriculum.status === "DRAFT" ? (
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button onClick={addRow} variant="outline">
                <Plus aria-hidden="true" />
                Tambah mata kuliah
              </Button>
              <Button disabled={replaceStructure.isPending} onClick={save}>
                {replaceStructure.isPending
                  ? "Menyimpan..."
                  : "Simpan struktur"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default CurriculumStructurePage;

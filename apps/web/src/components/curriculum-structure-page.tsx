import type { CurriculumCourseType } from "@siakad-itbkmmubar/api/curriculum";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import CurriculumCourseDialog from "@/components/curriculum-course-dialog";
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

const semesters = Array.from({ length: 8 }, (_, index) => index + 1);

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
  const [addDialog, setAddDialog] = useState<
    { id: number; semester: number } | undefined
  >();
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
  const courseSuggestions = availableCourses.flatMap((course) => {
    const id = recordText(course, "id");
    const code = recordText(course, "code");
    const name = recordText(course, "name");
    if (!(id && code && name)) {
      return [];
    }
    return [
      {
        code,
        credits: recordText(course, "credits"),
        id,
        name,
      },
    ];
  });
  const openAddDialog = (semester: number) => {
    setAddDialog((current) => ({
      id: (current?.id ?? 0) + 1,
      semester,
    }));
  };
  const addCourse = (
    course: (typeof courseSuggestions)[number],
    courseType: CurriculumCourseType
  ) => {
    if (!addDialog) {
      return;
    }
    if (rows.some((row) => row.courseId === course.id)) {
      toast.error("Mata kuliah tersebut sudah ada dalam kurikulum.");
      return;
    }
    updateRows((current) => [
      ...current,
      {
        courseId: course.id,
        courseType,
        id: createUuidV7(),
        semester: addDialog.semester,
      },
    ]);
    setAddDialog(undefined);
  };
  const updateCourseType = (id: string, courseType: CurriculumCourseType) => {
    updateRows((current) =>
      current.map((row) => (row.id === id ? { ...row, courseType } : row))
    );
  };
  const removeCourse = (id: string) => {
    updateRows((current) => current.filter((row) => row.id !== id));
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
      <section
        aria-label="Struktur mata kuliah per semester"
        className="grid gap-4 md:grid-cols-2"
      >
        {semesters.map((semester) => {
          const semesterRows = rows.filter((row) => row.semester === semester);
          return (
            <Card key={semester}>
              <CardHeader>
                <div>
                  <CardTitle>Semester {semester}</CardTitle>
                  <CardDescription>
                    {semesterRows.length} mata kuliah
                  </CardDescription>
                </div>
                {canManage && curriculum.status === "DRAFT" ? (
                  <CardAction>
                    <Button
                      onClick={() => openAddDialog(semester)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus aria-hidden="true" />
                      Tambah mata kuliah
                    </Button>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-3">
                {semesterRows.length === 0 ? (
                  <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-sm">
                    Belum ada mata kuliah pada semester ini.
                  </p>
                ) : (
                  semesterRows.map((row, index) => (
                    <div
                      className="grid gap-2 rounded-xl border border-[#dbe5ee] p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center"
                      key={row.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {courseLabel(row.courseId)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Mata kuliah {index + 1}
                        </p>
                      </div>
                      <label
                        className="grid gap-1 text-xs font-medium"
                        htmlFor={`type-${row.id}`}
                      >
                        Jenis
                        <select
                          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                          disabled={!canManage || curriculum.status !== "DRAFT"}
                          id={`type-${row.id}`}
                          onChange={(event) =>
                            updateCourseType(
                              row.id,
                              event.target.value as CurriculumCourseType
                            )
                          }
                          value={row.courseType}
                        >
                          <option value="REQUIRED">Wajib</option>
                          <option value="ELECTIVE">Pilihan</option>
                        </select>
                      </label>
                      {canManage && curriculum.status === "DRAFT" ? (
                        <Button
                          aria-label={`Hapus ${courseLabel(row.courseId)}`}
                          onClick={() => removeCourse(row.id)}
                          size="icon-sm"
                          variant="outline"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
      {canManage && curriculum.status === "DRAFT" ? (
        <div className="flex justify-end">
          <Button disabled={replaceStructure.isPending} onClick={save}>
            {replaceStructure.isPending ? "Menyimpan..." : "Simpan struktur"}
          </Button>
        </div>
      ) : null}
      {addDialog ? (
        <CurriculumCourseDialog
          courseSuggestions={courseSuggestions.filter(
            (course) => !rows.some((row) => row.courseId === course.id)
          )}
          isLoading={courseOptions.isPending}
          key={addDialog.id}
          onAdd={addCourse}
          onClose={() => setAddDialog(undefined)}
          open
          semester={addDialog.semester}
        />
      ) : null}
    </div>
  );
};

export default CurriculumStructurePage;

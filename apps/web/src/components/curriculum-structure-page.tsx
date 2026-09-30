import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { createUuidV7 } from "@siakad-itbkmmubar/uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ListPlus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import CurriculumCatalogImportDialog from "@/components/curriculum-catalog-import-dialog";
import CurriculumCourseDialog from "@/components/curriculum-course-dialog";
import CurriculumSemesterCard from "@/components/curriculum-semester-card";
import type { StructureRow } from "@/components/curriculum-semester-card";
import { curriculumRoutePaths, recordText } from "@/components/curriculum-ui";
import type { CurriculumBasePath } from "@/components/curriculum-ui";
import { orpc } from "@/utils/orpc";

interface CurriculumStructurePageProps {
  basePath: CurriculumBasePath;
  canManage: boolean;
  curriculumId: string;
  roleName: string;
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
  const [catalogImportOpen, setCatalogImportOpen] = useState(false);
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
  const importFromCatalog = useMutation(
    orpc.curriculum.structure.importFromCatalog.mutationOptions({
      onError: () =>
        toast.error("Mata kuliah dari katalog belum dapat diimpor."),
      onSuccess: async (result) => {
        setCatalogImportOpen(false);
        if (result.importedCount > 0) {
          toast.success(
            `${result.importedCount} mata kuliah berhasil diimpor dari katalog.`
          );
        } else {
          toast("Tidak ada mata kuliah baru dengan semester bawaan 1–8.");
        }
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
  const hasUnsavedChanges = draft?.curriculumId === curriculumId;
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
    courseType: StructureRow["courseType"]
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
  const updateCourseType = (
    id: string,
    courseType: StructureRow["courseType"]
  ) => {
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
          <div className="flex flex-wrap justify-end gap-2">
            {canManage && curriculum.status === "DRAFT" ? (
              <Button
                disabled={importFromCatalog.isPending}
                onClick={() => {
                  if (hasUnsavedChanges) {
                    toast.error(
                      "Simpan atau batalkan perubahan struktur sebelum mengimpor dari katalog."
                    );
                    return;
                  }
                  setCatalogImportOpen(true);
                }}
                variant="outline"
              >
                <ListPlus aria-hidden="true" />
                Impor dari katalog
              </Button>
            ) : null}
            <Link params={{ curriculumId }} to={detailRoute}>
              <Button variant="outline">
                <ArrowLeft aria-hidden="true" />
                Kembali ke detail
              </Button>
            </Link>
          </div>
        }
        description={`${curriculum.name} · ${curriculum.studyProgram.code} · ${curriculum.cohort.entryYear}`}
        eyebrow={`Kurikulum · ${roleName}`}
        title="Struktur kurikulum"
      />
      <section
        aria-label="Struktur mata kuliah per semester"
        className="grid gap-4 md:grid-cols-2"
      >
        {semesters.map((semester) => (
          <CurriculumSemesterCard
            canManage={canManage}
            courseLabel={courseLabel}
            isDraft={curriculum.status === "DRAFT"}
            key={semester}
            onAdd={openAddDialog}
            onRemove={removeCourse}
            onUpdateCourseType={updateCourseType}
            rows={rows.filter((row) => row.semester === semester)}
            semester={semester}
          />
        ))}
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
      <CurriculumCatalogImportDialog
        curriculumProgramName={curriculum.studyProgram.name}
        isPending={importFromCatalog.isPending}
        onCancel={() => setCatalogImportOpen(false)}
        onConfirm={() => {
          if (!hasUnsavedChanges && !importFromCatalog.isPending) {
            importFromCatalog.mutate({ curriculumId });
          }
        }}
        open={catalogImportOpen}
      />
    </div>
  );
};

export default CurriculumStructurePage;

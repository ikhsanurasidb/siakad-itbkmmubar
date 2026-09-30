import type { CurriculumCourseType } from "@siakad-itbkmmubar/api/curriculum";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export interface CourseSuggestion {
  code: string;
  credits: string;
  id: string;
  name: string;
}

interface CurriculumCourseDialogProps {
  courseSuggestions: readonly CourseSuggestion[];
  isLoading: boolean;
  onAdd: (course: CourseSuggestion, courseType: CurriculumCourseType) => void;
  onClose: () => void;
  open: boolean;
  semester: number;
}

const MAX_SEARCH_SUGGESTIONS = 4;

const CurriculumCourseDialog = ({
  courseSuggestions,
  isLoading,
  onAdd,
  onClose,
  open,
  semester,
}: CurriculumCourseDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseType, setCourseType] =
    useState<CurriculumCourseType>("REQUIRED");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const searchTerm = courseSearch.trim().toLowerCase();
  const suggestions = courseSuggestions
    .filter((course) => {
      if (!searchTerm) {
        return true;
      }
      return `${course.code} ${course.name}`.toLowerCase().includes(searchTerm);
    })
    .slice(0, MAX_SEARCH_SUGGESTIONS);
  const selectedCourse = courseSuggestions.find(
    (course) => course.id === selectedCourseId
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCourse) {
      onAdd(selectedCourse, courseType);
    }
  };

  let suggestionContent: ReactNode;
  if (isLoading) {
    suggestionContent = (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        Memuat daftar mata kuliah...
      </p>
    );
  } else if (suggestions.length === 0) {
    suggestionContent = (
      <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        Mata kuliah aktif tidak ditemukan.
      </p>
    );
  } else {
    suggestionContent = suggestions.map((course) => {
      const isSelected = course.id === selectedCourseId;
      return (
        <button
          aria-pressed={isSelected}
          className={`grid gap-1 rounded-xl border p-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
          key={course.id}
          onClick={() => setSelectedCourseId(course.id)}
          type="button"
        >
          <span className="font-medium">
            {course.code} · {course.name}
          </span>
          <span className="text-muted-foreground text-xs">
            {course.credits ? `${course.credits} SKS` : "SKS belum diatur"}
          </span>
        </button>
      );
    });
  }

  return (
    <dialog
      aria-labelledby="curriculum-course-dialog-title"
      className="bg-background text-foreground backdrop:bg-foreground/40 ring-border/70 m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl p-0 shadow-xl ring-1"
      onCancel={onClose}
      ref={dialogRef}
    >
      <form
        className="grid max-h-[90svh] gap-5 overflow-auto p-5"
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="font-semibold" id="curriculum-course-dialog-title">
              Tambah mata kuliah
            </h2>
            <p className="text-muted-foreground text-sm">
              Pilih mata kuliah untuk Semester {semester}.
            </p>
          </div>
          <Button
            aria-label="Tutup dialog tambah mata kuliah"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <FormField
          helper="Ketik kode atau nama untuk menampilkan saran mata kuliah aktif."
          id="curriculum-course-search"
          label="Cari mata kuliah"
        >
          <Input
            autoComplete="off"
            id="curriculum-course-search"
            onChange={(event) => setCourseSearch(event.target.value)}
            placeholder="Contoh: MKU atau Kewirausahaan"
            value={courseSearch}
          />
        </FormField>

        <div aria-live="polite" className="grid gap-2">
          {suggestionContent}
        </div>

        <FormField id="curriculum-course-type" label="Jenis mata kuliah">
          <select
            className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
            id="curriculum-course-type"
            onChange={(event) =>
              setCourseType(event.target.value as CurriculumCourseType)
            }
            value={courseType}
          >
            <option value="REQUIRED">Wajib</option>
            <option value="ELECTIVE">Pilihan</option>
          </select>
        </FormField>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Batal
          </Button>
          <Button disabled={!selectedCourse} type="submit">
            Tambahkan ke Semester {semester}
          </Button>
        </div>
      </form>
    </dialog>
  );
};

export default CurriculumCourseDialog;

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
import { Plus, Trash2 } from "lucide-react";

export interface StructureRow {
  courseId: string;
  courseType: CurriculumCourseType;
  id: string;
  semester: number;
}

interface CurriculumSemesterCardProps {
  canManage: boolean;
  courseLabel: (courseId: string) => string;
  isDraft: boolean;
  onAdd: (semester: number) => void;
  onRemove: (id: string) => void;
  onUpdateCourseType: (id: string, courseType: CurriculumCourseType) => void;
  rows: readonly StructureRow[];
  semester: number;
}

const CurriculumSemesterCard = ({
  canManage,
  courseLabel,
  isDraft,
  onAdd,
  onRemove,
  onUpdateCourseType,
  rows,
  semester,
}: CurriculumSemesterCardProps) => (
  <Card>
    <CardHeader>
      <div>
        <CardTitle>Semester {semester}</CardTitle>
        <CardDescription>{rows.length} mata kuliah</CardDescription>
      </div>
      {canManage && isDraft ? (
        <CardAction>
          <Button onClick={() => onAdd(semester)} size="sm" variant="outline">
            <Plus aria-hidden="true" />
            Tambah mata kuliah
          </Button>
        </CardAction>
      ) : null}
    </CardHeader>
    <CardContent className="grid gap-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-sm">
          Belum ada mata kuliah pada semester ini.
        </p>
      ) : (
        rows.map((row, index) => (
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
                disabled={!canManage || !isDraft}
                id={`type-${row.id}`}
                onChange={(event) =>
                  onUpdateCourseType(
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
            {canManage && isDraft ? (
              <Button
                aria-label={`Hapus ${courseLabel(row.courseId)}`}
                onClick={() => onRemove(row.id)}
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

export default CurriculumSemesterCard;

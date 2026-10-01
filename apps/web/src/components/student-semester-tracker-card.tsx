import {
  studentAcademicStatusLabels,
  studentAcademicStatuses,
} from "@siakad-itbkmmubar/api/master-data";
import type { StudentAcademicStatus } from "@siakad-itbkmmubar/api/master-data";
import type { StudentSemesterTrackerRecord } from "@siakad-itbkmmubar/api/study-plan";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Check, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface StudentSemesterTrackerCardProps {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onStatusUpdate: (
    studentId: string,
    status: StudentAcademicStatus,
    expectedVersion: number
  ) => void;
  onUpdate: (studentId: string, semesterNumber: number) => void;
  periodSelected: boolean;
  rows: readonly StudentSemesterTrackerRecord[];
  updatingStudentId: string | null;
}

const studentAcademicStatusOptions = studentAcademicStatuses.map((status) => ({
  label: studentAcademicStatusLabels[status],
  value: status,
}));
const studentAcademicStatusSet = new Set(studentAcademicStatuses);

const StudentSemesterTrackerCard = ({
  isError,
  isPending,
  onRetry,
  onStatusUpdate,
  onUpdate,
  periodSelected,
  rows,
  updatingStudentId,
}: StudentSemesterTrackerCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = periodSelected && !isPending && !isError && rows.length > 0;
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
        Tidak ada mahasiswa pada filter yang dipilih.
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
                Status akademik
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
                  {isEditing ? (
                    <>
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
                    </>
                  ) : (
                    <span>
                      {row.semesterNumber
                        ? `Semester ${row.semesterNumber}`
                        : "Belum ditentukan"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <>
                      <label
                        className="sr-only"
                        htmlFor={`academic-status-${row.student.id}`}
                      >
                        Status akademik {row.student.nim}
                      </label>
                      <select
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                        disabled={updatingStudentId === row.student.id}
                        id={`academic-status-${row.student.id}`}
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          if (
                            studentAcademicStatusSet.has(
                              nextStatus as StudentAcademicStatus
                            )
                          ) {
                            onStatusUpdate(
                              row.student.id,
                              nextStatus as StudentAcademicStatus,
                              row.student.version
                            );
                          }
                        }}
                        value={row.student.academicStatus}
                      >
                        {studentAcademicStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    studentAcademicStatusLabels[row.student.academicStatus]
                  )}
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
          Semester dihitung otomatis dari angkatan dan tahun akademik. Pilih
          Edit untuk mengoreksi semester secara manual; perubahan tersimpan
          langsung sebagai acuan proses akademik pada periode tersebut.
        </CardDescription>
        <CardAction>
          <Button
            disabled={!canEdit}
            onClick={() => setIsEditing((editing) => !editing)}
            type="button"
            variant="outline"
          >
            {isEditing ? (
              <>
                <Check aria-hidden="true" />
                Selesai
              </>
            ) : (
              <>
                <Pencil aria-hidden="true" />
                Edit
              </>
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default StudentSemesterTrackerCard;

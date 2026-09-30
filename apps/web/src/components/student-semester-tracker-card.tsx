import { studentAcademicStatusLabels } from "@siakad-itbkmmubar/api/master-data";
import type { StudentSemesterTrackerRecord } from "@siakad-itbkmmubar/api/study-plan";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import type { ReactNode } from "react";

interface StudentSemesterTrackerCardProps {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onUpdate: (studentId: string, semesterNumber: number) => void;
  periodSelected: boolean;
  rows: readonly StudentSemesterTrackerRecord[];
  updatingStudentId: string | null;
}

const StudentSemesterTrackerCard = ({
  isError,
  isPending,
  onRetry,
  onUpdate,
  periodSelected,
  rows,
  updatingStudentId,
}: StudentSemesterTrackerCardProps) => {
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
                  {studentAcademicStatusLabels[row.student.academicStatus]}
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
          manual akan menjadi acuan bersama untuk proses akademik pada periode
          tersebut.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default StudentSemesterTrackerCard;

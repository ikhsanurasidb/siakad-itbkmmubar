import type {
  ScheduleModality,
  ScheduleSectionRecord,
} from "@siakad-itbkmmubar/api/scheduling";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { FilePreviewDialog } from "@siakad-itbkmmubar/ui/components/file-preview-dialog";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { SearchableSelect } from "@siakad-itbkmmubar/ui/components/searchable-select";
import type {
  SearchableSelectOption,
  SearchableSelectStatus,
} from "@siakad-itbkmmubar/ui/components/searchable-select";
import { Textarea } from "@siakad-itbkmmubar/ui/components/textarea";
import { CalendarPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

export const schedulingStatusLabels = {
  APPROVED: "Disetujui",
  DRAFT: "Draf",
  PUBLISHED: "Diterbitkan",
  REJECTED: "Ditolak",
  SUBMITTED: "Diajukan",
} as const;

interface ClassPreviewCardProps {
  academicPeriodLabel?: string;
  canCreateSchedule: boolean;
  onClose: () => void;
  onCreateSchedule: () => void;
  section: ScheduleSectionRecord;
}

export const ClassPreviewCard = ({
  academicPeriodLabel,
  canCreateSchedule,
  onClose,
  onCreateSchedule,
  section,
}: ClassPreviewCardProps) => (
  <FilePreviewDialog
    fileName={`Preview ${section.courseCode} · Kelas ${section.code}`}
    onClose={onClose}
    open
  >
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Periksa data kelas sebelum membuat jadwal pertemuan.
      </p>
      <div className="bg-muted/20 grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs">Mata kuliah</p>
          <p className="font-semibold">
            {section.courseCode} · {section.courseName}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Kelas</p>
          <p className="font-semibold">{section.code}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Peserta</p>
          <p className="font-semibold">
            {section.enrolledCount} dari {section.capacity} mahasiswa
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Status</p>
          <p className="font-semibold">
            {schedulingStatusLabels[section.status]}
          </p>
        </div>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Periode akademik</dt>
          <dd>{academicPeriodLabel ?? section.academicPeriodId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dosen pengampu</dt>
          <dd>
            {section.lecturerNames.length
              ? section.lecturerNames.join(", ")
              : "Belum ditentukan"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Batas perubahan</dt>
          <dd>H-{section.policyLeadDays}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Maks. pertemuan daring</dt>
          <dd>{section.policyMaxOnlineMeetings} pertemuan</dd>
        </div>
      </dl>
      {canCreateSchedule ? (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={onCreateSchedule}>
            <CalendarPlus aria-hidden="true" />
            Buat jadwal
          </Button>
          <p className="text-muted-foreground text-sm">
            Jadwal akan langsung diterbitkan setelah validasi konflik berhasil.
          </p>
        </div>
      ) : null}
    </div>
  </FilePreviewDialog>
);

interface ScheduleCreateDialogProps {
  errorMessage?: string;
  lecturerOptions: readonly SearchableSelectOption[];
  lecturerStatus: SearchableSelectStatus;
  onClose: () => void;
  onSubmit: (input: {
    dayOfWeek: number;
    endTime: string;
    instructions?: string;
    lecturerIds: string[];
    modality: ScheduleModality;
    roomId?: string;
    startTime: string;
  }) => void;
  roomOptions: readonly SearchableSelectOption[];
  roomStatus: SearchableSelectStatus;
  section: ScheduleSectionRecord;
  submitting: boolean;
}

const dayOptions = [
  [1, "Senin"],
  [2, "Selasa"],
  [3, "Rabu"],
  [4, "Kamis"],
  [5, "Jumat"],
  [6, "Sabtu"],
  [7, "Minggu"],
] as const;

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2";

export const ScheduleCreateDialog = ({
  errorMessage,
  lecturerOptions,
  lecturerStatus,
  onClose,
  onSubmit,
  roomOptions,
  roomStatus,
  section,
  submitting,
}: ScheduleCreateDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [endTime, setEndTime] = useState("");
  const [formError, setFormError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [secondLecturerId, setSecondLecturerId] = useState("");
  const [modality, setModality] = useState<ScheduleModality>("OFFLINE");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const handleBackdropPointerDown = (event: PointerEvent) => {
      if (event.target === dialog) {
        onClose();
      }
    };
    dialog.addEventListener("pointerdown", handleBackdropPointerDown);
    return () => {
      dialog.removeEventListener("pointerdown", handleBackdropPointerDown);
    };
  }, [onClose]);

  const secondaryLecturerOptions = lecturerOptions.filter(
    (option) => option.value !== lecturerId
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedLecturerIds = [lecturerId, secondLecturerId].filter(
      (value): value is string => Boolean(value)
    );
    let validationError = "";
    if (lecturerId.length === 0) {
      validationError = "Pilih minimal satu dosen pengampu.";
    } else if (startTime.length === 0 || endTime.length === 0) {
      validationError = "Isi jam mulai dan jam selesai.";
    } else if (endTime <= startTime) {
      validationError = "Jam selesai harus setelah jam mulai.";
    } else if (modality === "OFFLINE" && roomId.length === 0) {
      validationError = "Pilih ruang untuk jadwal luring.";
    }
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    onSubmit({
      dayOfWeek: Number(dayOfWeek),
      endTime,
      instructions: instructions.trim() || undefined,
      lecturerIds: selectedLecturerIds,
      modality,
      roomId: modality === "OFFLINE" ? roomId : undefined,
      startTime,
    });
  };

  return (
    <dialog
      aria-labelledby="schedule-create-title"
      className="bg-background text-foreground backdrop:bg-foreground/40 ring-border/70 m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl p-0 shadow-xl ring-1"
      onCancel={onClose}
      ref={dialogRef}
    >
      <form
        className="grid max-h-[90svh] gap-4 overflow-auto p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="schedule-create-title">
              Buat jadwal
            </h2>
            <p className="text-muted-foreground text-sm">
              Jadwal diterbitkan setelah seluruh konflik tervalidasi.
            </p>
          </div>
          <Button
            aria-label="Tutup dialog buat jadwal"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <FormField id="schedule-create-class" label="Kelas kuliah">
          <Input
            id="schedule-create-class"
            readOnly
            value={`${section.courseCode} · Kelas ${section.code} · ${section.courseName}`}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField id="schedule-create-day" label="Hari">
            <select
              className={selectClassName}
              id="schedule-create-day"
              onChange={(event) => setDayOfWeek(event.target.value)}
              value={dayOfWeek}
            >
              {dayOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="schedule-create-start" label="Jam mulai">
            <Input
              id="schedule-create-start"
              onChange={(event) => setStartTime(event.target.value)}
              type="time"
              value={startTime}
            />
          </FormField>
          <FormField id="schedule-create-end" label="Jam selesai">
            <Input
              id="schedule-create-end"
              onChange={(event) => setEndTime(event.target.value)}
              type="time"
              value={endTime}
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="schedule-create-modality" label="Mode">
            <select
              className={selectClassName}
              id="schedule-create-modality"
              onChange={(event) => {
                const value = event.target.value as ScheduleModality;
                setModality(value);
                if (value === "ONLINE") {
                  setRoomId("");
                }
              }}
              value={modality}
            >
              <option value="OFFLINE">Luring</option>
              <option value="ONLINE">Daring</option>
            </select>
          </FormField>
          {modality === "OFFLINE" ? (
            <SearchableSelect
              id="schedule-create-room"
              label="Ruang"
              onValueChange={setRoomId}
              options={roomOptions}
              portalContainer={dialogRef}
              placeholder="Pilih ruang"
              status={roomStatus}
              value={roomId}
            />
          ) : (
            <div className="border-muted-foreground/30 bg-muted/20 text-muted-foreground flex items-center rounded-xl border p-3 text-sm">
              Jadwal daring tidak membutuhkan ruang fisik.
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect
            id="schedule-create-lecturer"
            label="Pengampu 1"
            onValueChange={(value) => {
              setLecturerId(value);
              if (value === secondLecturerId) {
                setSecondLecturerId("");
              }
            }}
            options={lecturerOptions}
            portalContainer={dialogRef}
            placeholder="Pilih dosen pengampu"
            status={lecturerStatus}
            value={lecturerId}
          />
          <SearchableSelect
            id="schedule-create-second-lecturer"
            label="Pengampu 2"
            onValueChange={setSecondLecturerId}
            options={secondaryLecturerOptions}
            optional
            portalContainer={dialogRef}
            placeholder="Pilih dosen kedua (opsional)"
            status={lecturerStatus}
            value={secondLecturerId}
          />
        </div>

        <FormField
          id="schedule-create-instructions"
          label="Catatan/instruksi"
          optional
        >
          <Textarea
            id="schedule-create-instructions"
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Catatan untuk dosen atau mahasiswa"
            rows={3}
            value={instructions}
          />
        </FormField>

        {formError || errorMessage ? (
          <p className="text-destructive text-sm" role="alert">
            {formError || errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button onClick={onClose} type="button" variant="outline">
            Batal
          </Button>
          <Button disabled={submitting} type="submit">
            <CalendarPlus aria-hidden="true" />
            {submitting ? "Memvalidasi…" : "Buat jadwal"}
          </Button>
        </div>
      </form>
    </dialog>
  );
};

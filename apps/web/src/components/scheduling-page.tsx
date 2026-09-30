import { formatAcademicPeriodLabel } from "@siakad-itbkmmubar/api/master-data";
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
import { SearchableSelect } from "@siakad-itbkmmubar/ui/components/searchable-select";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface SearchableSelectOption {
  description?: string;
  label: string;
  value: string;
}
type SearchableSelectStatus = "error" | "loading" | "ready";

const recordText = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const getSelectStatus = (
  isPending: boolean,
  isError: boolean
): SearchableSelectStatus => {
  if (isPending) {
    return "loading";
  }
  if (isError) {
    return "error";
  }
  return "ready";
};

interface SchedulingPageProps {
  mode: "ADMIN" | "APPROVAL" | "LECTURER" | "STUDENT";
  roleName: string;
  view?: "changes" | "mapping" | "overview";
}

const schedulingViewCopy = {
  changes: {
    description:
      "Tinjau pengajuan perubahan dan terbitkan draft jadwal yang sudah disetujui.",
    title: "Perubahan jadwal",
  },
  mapping: {
    description:
      "Bentuk kelas dari KRS final dan periksa hasil pemetaan sebelum jadwal diterbitkan.",
    title: "Pemetaan kelas",
  },
  overview: {
    description:
      "Bentuk kelas dari KRS final, selesaikan konflik, dan publikasikan jadwal secara terkontrol.",
    title: "Kelas dan penjadwalan",
  },
} as const;

const formatDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusLabels = {
  APPROVED: "Disetujui",
  DRAFT: "Draf",
  PUBLISHED: "Diterbitkan",
  REJECTED: "Ditolak",
  SUBMITTED: "Diajukan",
} as const;

// eslint-disable-next-line complexity -- this component coordinates role-specific scheduling views and mutations.
const SchedulingPage = ({
  mode,
  roleName,
  view = "overview",
}: SchedulingPageProps) => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [classCapacity, setClassCapacity] = useState("30");
  const [draftId, setDraftId] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("0");
  const [meetingId, setMeetingId] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const masterDataEnabled = mode === "ADMIN" && view !== "changes";
  const draftsEnabled =
    mode === "APPROVAL" || (mode === "ADMIN" && view !== "mapping");
  const changeRequestsEnabled = mode === "ADMIN" && view !== "mapping";

  const sections = useQuery(
    orpc.scheduling.sections.list.queryOptions({ input: {} })
  );
  const drafts = useQuery({
    ...orpc.scheduling.drafts.list.queryOptions({ input: {} }),
    enabled: draftsEnabled,
  });
  const meetings = useQuery(orpc.scheduling.meetings.list.queryOptions());
  const changeRequests = useQuery({
    ...orpc.scheduling.changeRequests.list.queryOptions({
      input: { status: "PENDING" },
    }),
    enabled: changeRequestsEnabled,
  });
  const academicPeriods = useQuery({
    ...orpc.masterData.list.queryOptions({
      input: { entityType: "ACADEMIC_PERIOD", limit: 100, status: "ACTIVE" },
    }),
    enabled: masterDataEnabled,
  });
  const studyPrograms = useQuery({
    ...orpc.masterData.list.queryOptions({
      input: { entityType: "STUDY_PROGRAM", limit: 100, status: "ACTIVE" },
    }),
    enabled: masterDataEnabled,
  });
  const mapping = useMutation(
    orpc.scheduling.mapping.generate.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: (result) => {
        toast.success(
          `Pemetaan selesai: ${result.completedCount} kelompok diproses.`
        );
        queryClient.invalidateQueries({
          queryKey: orpc.scheduling.sections.key(),
        });
      },
    })
  );
  const decide = useMutation(
    orpc.scheduling.drafts.decide.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Keputusan persetujuan tersimpan.");
        queryClient.invalidateQueries({
          queryKey: orpc.scheduling.drafts.key(),
        });
      },
    })
  );
  const publish = useMutation(
    orpc.scheduling.drafts.publish.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Jadwal diterbitkan dan notifikasi dikirim.");
        queryClient.invalidateQueries({
          queryKey: orpc.scheduling.drafts.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.scheduling.meetings.key(),
        });
      },
    })
  );
  const setOnline = useMutation(
    orpc.scheduling.meetings.setOnline.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Pertemuan diubah menjadi daring.");
        setOnlineUrl("");
        setInstructions("");
        queryClient.invalidateQueries({
          queryKey: orpc.scheduling.meetings.key(),
        });
      },
    })
  );

  const isPending =
    sections.isPending ||
    meetings.isPending ||
    (draftsEnabled && drafts.isPending) ||
    (changeRequestsEnabled && changeRequests.isPending) ||
    (masterDataEnabled &&
      (academicPeriods.isPending || studyPrograms.isPending));
  const hasError =
    sections.isError ||
    meetings.isError ||
    (draftsEnabled && drafts.isError) ||
    (changeRequestsEnabled && changeRequests.isError) ||
    (masterDataEnabled && (academicPeriods.isError || studyPrograms.isError));
  const viewCopy = schedulingViewCopy[view];
  const showMappingPanel = mode === "ADMIN" && view !== "changes";
  const showChangesPanel = mode === "ADMIN" && view !== "mapping";
  const academicPeriodOptions: SearchableSelectOption[] = (
    academicPeriods.data?.data ?? []
  ).flatMap((period) => {
    const id = recordText(period, "id");
    if (!id) {
      return [];
    }
    const term = recordText(period, "term");
    const academicYear = recordText(period, "academicYearLabel");
    const startDate = recordText(period, "startDate").slice(0, 10);
    const endDate = recordText(period, "endDate").slice(0, 10);
    return [
      {
        description: [startDate, endDate].filter(Boolean).join(" – "),
        label: formatAcademicPeriodLabel(term || "akademik", academicYear),
        value: id,
      },
    ];
  });
  const studyProgramOptions: SearchableSelectOption[] = (
    studyPrograms.data?.data ?? []
  ).flatMap((program) => {
    const id = recordText(program, "id");
    const code = recordText(program, "code");
    const name = recordText(program, "name");
    return id && (code || name)
      ? [{ label: [code, name].filter(Boolean).join(" · "), value: id }]
      : [];
  });
  const meetingOptions: SearchableSelectOption[] = (meetings.data ?? []).map(
    (meeting) => ({
      description: `${meeting.courseName} · ${formatDate.format(new Date(meeting.startAt))}`,
      label: `${meeting.classCode} · Pertemuan ${meeting.sequence}`,
      value: meeting.id,
    })
  );
  const draftOptions: SearchableSelectOption[] = (drafts.data ?? []).map(
    (draft) => ({
      description: `${statusLabels[draft.status]} · versi ${draft.version}`,
      label: `Draf ${draft.id.slice(0, 8)}`,
      value: draft.id,
    })
  );

  if (isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Kelola kelas kuliah, approval, dan jadwal pertemuan."
          eyebrow={`Penjadwalan · ${roleName}`}
          title={viewCopy.title}
        />
        <State
          description="Data kelas dan jadwal sedang dimuat."
          title="Memuat penjadwalan"
          variant="loading"
        />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Kelola kelas kuliah, approval, dan jadwal pertemuan."
          eyebrow={`Penjadwalan · ${roleName}`}
          title={viewCopy.title}
        />
        <State
          action={
            <Button
              onClick={() => {
                sections.refetch();
                drafts.refetch();
                meetings.refetch();
                changeRequests.refetch();
                academicPeriods.refetch();
                studyPrograms.refetch();
              }}
              variant="outline"
            >
              <RefreshCw aria-hidden="true" /> Coba lagi
            </Button>
          }
          description="Data penjadwalan belum dapat dimuat."
          title="Penjadwalan tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description={viewCopy.description}
        eyebrow={`Penjadwalan · ${roleName}`}
        title={viewCopy.title}
      />

      {showMappingPanel && (
        <Card>
          <CardHeader>
            <CardTitle>Pemetaan kelas dari KRS final</CardTitle>
            <CardDescription>
              Pemetaan dapat diulang dengan aman; progress job disimpan di D1.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <SearchableSelect
              id="scheduling-academic-period"
              label="Periode akademik"
              onValueChange={setAcademicPeriodId}
              options={academicPeriodOptions}
              placeholder="Cari periode akademik"
              status={getSelectStatus(
                academicPeriods.isPending,
                academicPeriods.isError
              )}
              value={academicPeriodId}
            />
            <SearchableSelect
              id="scheduling-study-program"
              label="Program studi"
              onValueChange={setStudyProgramId}
              options={studyProgramOptions}
              optional
              placeholder="Cari Prodi (opsional)"
              status={getSelectStatus(
                studyPrograms.isPending,
                studyPrograms.isError
              )}
              value={studyProgramId}
            />
            <Input
              aria-label="Kapasitas kelas"
              min={1}
              onChange={(event) => setClassCapacity(event.target.value)}
              type="number"
              value={classCapacity}
            />
            <Button
              disabled={
                !academicPeriodOptions.some(
                  (option) => option.value === academicPeriodId
                ) || mapping.isPending
              }
              onClick={() =>
                mapping.mutate({
                  academicPeriodId,
                  classCapacity: Number(classCapacity),
                  studyProgramId: studyProgramId || undefined,
                })
              }
            >
              {mapping.isPending ? "Memproses…" : "Jalankan pemetaan"}
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "LECTURER" && (
        <Card>
          <CardHeader>
            <CardTitle>Ubah pertemuan menjadi daring</CardTitle>
            <CardDescription>
              Perubahan mengikuti cutoff H-7 dan batas maksimum pertemuan
              daring.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <SearchableSelect
              id="scheduling-meeting"
              label="Pertemuan"
              onValueChange={setMeetingId}
              options={meetingOptions}
              placeholder="Cari pertemuan"
              status={getSelectStatus(meetings.isPending, meetings.isError)}
              value={meetingId}
            />
            <Input
              aria-label="Tautan pertemuan daring"
              onChange={(event) => setOnlineUrl(event.target.value)}
              placeholder="https://…"
              type="url"
              value={onlineUrl}
            />
            <Input
              aria-label="Instruksi akses"
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Instruksi akses (opsional)"
              value={instructions}
            />
            <Button
              disabled={
                !meetingOptions.some((option) => option.value === meetingId) ||
                setOnline.isPending
              }
              onClick={() =>
                setOnline.mutate({
                  instructions: instructions || undefined,
                  meetingId,
                  onlineUrl: onlineUrl || undefined,
                })
              }
            >
              <Video aria-hidden="true" /> Simpan perubahan
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "APPROVAL" && (
        <Card>
          <CardHeader>
            <CardTitle>Persetujuan jadwal</CardTitle>
            <CardDescription>
              Approval dibatasi pada Prodi yang menjadi tanggung jawab Kaprodi.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(drafts.data ?? [])
              .filter((draft) => draft.status === "SUBMITTED")
              .map((draft) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
                  key={draft.id}
                >
                  <div>
                    <p className="font-semibold">
                      Draft {draft.id.slice(0, 8)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {draft.conflicts.length} konflik · versi {draft.version}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          approve: false,
                          draftId: draft.id,
                          expectedVersion: draft.version,
                          reason:
                            "Jadwal perlu diperbaiki sebelum diterbitkan.",
                        })
                      }
                      variant="outline"
                    >
                      Tolak
                    </Button>
                    <Button
                      disabled={
                        decide.isPending ||
                        draft.conflicts.some(
                          (conflict) => conflict.severity === "BLOCKING"
                        )
                      }
                      onClick={() =>
                        decide.mutate({
                          approve: true,
                          draftId: draft.id,
                          expectedVersion: draft.version,
                        })
                      }
                    >
                      Setujui
                    </Button>
                  </div>
                </div>
              ))}
            {(drafts.data ?? []).filter((draft) => draft.status === "SUBMITTED")
              .length === 0 && (
              <State
                description="Belum ada draft yang menunggu keputusan."
                title="Tidak ada pengajuan"
                variant="not-found"
              />
            )}
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Ringkasan kelas dan jadwal"
        className="grid gap-4 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>Kelas kuliah</CardTitle>
            <CardDescription>
              {sections.data?.length ?? 0} kelas dalam lingkup akses Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(sections.data ?? []).map((section) => (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border p-4"
                key={section.id}
              >
                <div>
                  <p className="font-semibold">
                    {section.courseCode} · {section.code}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {section.courseName} · {section.enrolledCount}/
                    {section.capacity} mahasiswa
                  </p>
                </div>
                <span className="rounded-full bg-[#e7f7ef] px-2.5 py-1 text-xs font-semibold text-[#137a4b]">
                  {statusLabels[section.status]}
                </span>
              </div>
            ))}
            {sections.data?.length === 0 && (
              <State
                description="Pemetaan KRS final belum menghasilkan kelas."
                title="Belum ada kelas"
                variant="not-found"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jadwal pertemuan</CardTitle>
            <CardDescription>
              {meetings.data?.length ?? 0} pertemuan yang dapat Anda lihat.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(meetings.data ?? []).slice(0, 12).map((meeting) => (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border p-4"
                key={meeting.id}
              >
                <div>
                  <p className="font-semibold">
                    {meeting.classCode} · pertemuan {meeting.sequence}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {meeting.courseName} ·{" "}
                    {formatDate.format(new Date(meeting.startAt))}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2.5 py-1 text-xs font-semibold text-[#0b63b6]">
                  {meeting.modality === "ONLINE" && (
                    <Video aria-hidden="true" className="size-3.5" />
                  )}
                  {meeting.modality === "ONLINE" ? "Daring" : "Luring"}
                </span>
              </div>
            ))}
            {meetings.data?.length === 0 && (
              <State
                description="Jadwal terbit akan muncul di sini."
                title="Belum ada jadwal"
                variant="not-found"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {showChangesPanel && (
        <Card>
          <CardHeader>
            <CardTitle>Draft jadwal dan pengajuan perubahan</CardTitle>
            <CardDescription>
              Publikasikan hanya draft yang sudah disetujui dan tanpa konflik
              penghambat.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <SearchableSelect
                id="scheduling-draft"
                label="Draft jadwal"
                onValueChange={setDraftId}
                options={draftOptions}
                placeholder="Cari draft jadwal"
                status={getSelectStatus(drafts.isPending, drafts.isError)}
                value={draftId}
              />
              <Input
                aria-label="Versi draft"
                min={0}
                onChange={(event) => setExpectedVersion(event.target.value)}
                type="number"
                value={expectedVersion}
              />
              <Button
                disabled={
                  !draftOptions.some((option) => option.value === draftId) ||
                  publish.isPending
                }
                onClick={() =>
                  publish.mutate({
                    draftId,
                    expectedVersion: Number(expectedVersion),
                  })
                }
              >
                <CheckCircle2 aria-hidden="true" /> Terbitkan draft
              </Button>
            </div>
            {(changeRequests.data ?? []).map((request) => (
              <p className="text-muted-foreground text-sm" key={request.id}>
                Pengajuan {request.classCode} · {request.reason}
              </p>
            ))}
            {(drafts.data ?? []).map((draft) => (
              <p className="text-muted-foreground text-sm" key={draft.id}>
                Draf {draft.id.slice(0, 8)} · {statusLabels[draft.status]} ·
                versi {draft.version}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <CalendarDays aria-hidden="true" className="size-3.5" /> Semua perubahan
        jadwal dicatat sebagai revision dan audit.
      </p>
    </div>
  );
};

export default SchedulingPage;

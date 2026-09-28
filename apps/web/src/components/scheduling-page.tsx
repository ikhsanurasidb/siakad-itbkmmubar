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
import { CalendarDays, CheckCircle2, RefreshCw, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface SchedulingPageProps {
  mode: "ADMIN" | "APPROVAL" | "LECTURER" | "STUDENT";
  roleName: string;
}

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
const SchedulingPage = ({ mode, roleName }: SchedulingPageProps) => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [classCapacity, setClassCapacity] = useState("30");
  const [draftId, setDraftId] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("0");
  const [meetingId, setMeetingId] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  const sections = useQuery(
    orpc.scheduling.sections.list.queryOptions({ input: {} })
  );
  const drafts = useQuery(
    orpc.scheduling.drafts.list.queryOptions({ input: {} })
  );
  const meetings = useQuery(orpc.scheduling.meetings.list.queryOptions());
  const changeRequests = useQuery(
    orpc.scheduling.changeRequests.list.queryOptions({
      input: { status: "PENDING" },
    })
  );
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
    drafts.isPending ||
    meetings.isPending ||
    changeRequests.isPending;
  const hasError =
    sections.isError ||
    drafts.isError ||
    meetings.isError ||
    changeRequests.isError;

  if (isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Kelola kelas kuliah, approval, dan jadwal pertemuan."
          eyebrow={`Penjadwalan · ${roleName}`}
          title="Kelas dan penjadwalan"
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
          title="Kelas dan penjadwalan"
        />
        <State
          action={
            <Button
              onClick={() => {
                sections.refetch();
                drafts.refetch();
                meetings.refetch();
                changeRequests.refetch();
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
        description="Bentuk kelas dari KRS final, selesaikan konflik, dan publikasikan jadwal secara terkontrol."
        eyebrow={`Penjadwalan · ${roleName}`}
        title="Kelas dan penjadwalan"
      />

      {mode === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Pemetaan kelas dari KRS final</CardTitle>
            <CardDescription>
              Pemetaan dapat diulang dengan aman; progress job disimpan di D1.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Input
              aria-label="ID periode akademik"
              onChange={(event) => setAcademicPeriodId(event.target.value)}
              placeholder="ID periode akademik"
              value={academicPeriodId}
            />
            <Input
              aria-label="ID program studi"
              onChange={(event) => setStudyProgramId(event.target.value)}
              placeholder="ID program studi (opsional)"
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
              disabled={!academicPeriodId || mapping.isPending}
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
            <Input
              aria-label="ID pertemuan"
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="ID pertemuan"
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
              disabled={!meetingId || setOnline.isPending}
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

      {mode === "ADMIN" && (
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
              <Input
                aria-label="ID draft jadwal"
                onChange={(event) => setDraftId(event.target.value)}
                placeholder="ID draft jadwal"
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
                disabled={!draftId || publish.isPending}
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

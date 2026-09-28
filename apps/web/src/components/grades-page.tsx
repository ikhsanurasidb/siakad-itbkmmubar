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
import { LockKeyhole, RefreshCw, Save, Send } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const statusLabels = {
  DRAFT: "Draf",
  LOCKED: "Terkunci",
  PUBLISHED: "Diterbitkan",
  SUBMITTED: "Diajukan",
} as const;

const statusClassNames = {
  DRAFT: "bg-slate-100 text-slate-700",
  LOCKED: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
} as const;

const safeMutationError =
  "Perubahan nilai belum dapat disimpan. Periksa data dan coba lagi.";

interface GradesClassPageProps {
  classSectionId: string;
}

const GradeResultTable = ({
  entries,
}: {
  entries: readonly {
    courseCode: string;
    courseName: string;
    credits: number;
    gradeCode: string;
    gradePoint: number;
    roundedScore: number;
  }[];
}) =>
  entries.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Hasil nilai</caption>
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="p-3">Mata kuliah</th>
            <th className="p-3">SKS</th>
            <th className="p-3">Nilai</th>
            <th className="p-3">Huruf</th>
            <th className="p-3">Bobot mutu</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              className="border-b last:border-0"
              key={`${entry.courseCode}-${entry.gradeCode}`}
            >
              <th className="p-3 font-medium">
                {entry.courseCode} · {entry.courseName}
              </th>
              <td className="p-3">{entry.credits}</td>
              <td className="p-3">{entry.roundedScore.toFixed(2)}</td>
              <td className="p-3">{entry.gradeCode}</td>
              <td className="p-3">{entry.gradePoint.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <State
      description="Belum ada nilai resmi untuk ditampilkan."
      title="Nilai belum tersedia"
      variant="not-found"
    />
  );

const GradeState = ({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
    <State
      action={action}
      description={description}
      title={title}
      variant={action ? "error" : "loading"}
    />
  </div>
);

export const GradesClassPage = ({ classSectionId }: GradesClassPageProps) => {
  const queryClient = useQueryClient();
  const detail = useQuery(
    orpc.grades.classes.detail.queryOptions({ input: { classSectionId } })
  );
  const [scores, setScores] = useState<Record<string, string>>({});
  const save = useMutation(
    orpc.grades.saveScores.mutationOptions({
      onError: () => toast.error(safeMutationError),
      onSuccess: async () => {
        toast.success("Nilai disimpan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.grades.classes.detail.key(),
        });
      },
    })
  );
  const submit = useMutation(
    orpc.grades.submit.mutationOptions({
      onError: () => toast.error(safeMutationError),
      onSuccess: async () => {
        toast.success("Nilai diajukan untuk dikunci.");
        await queryClient.invalidateQueries({
          queryKey: orpc.grades.classes.detail.key(),
        });
      },
    })
  );
  const lock = useMutation(
    orpc.grades.lock.mutationOptions({
      onError: () => toast.error(safeMutationError),
      onSuccess: async () => {
        toast.success("Nilai dikunci.");
        await queryClient.invalidateQueries({
          queryKey: orpc.grades.classes.detail.key(),
        });
      },
    })
  );

  if (detail.isPending) {
    return (
      <GradeState
        title="Memuat nilai"
        description="Data nilai kelas sedang dimuat."
      />
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <GradeState
        action={
          <Button onClick={() => detail.refetch()} variant="outline">
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        }
        description="Data nilai kelas belum dapat dimuat."
        title="Nilai tidak tersedia"
      />
    );
  }

  const classData = detail.data;
  const isDraft = classData.status === "DRAFT";
  const setScore = (studentId: string, componentId: string, value: string) => {
    setScores((current) => ({
      ...current,
      [`${studentId}:${componentId}`]: value,
    }));
  };
  const saveAll = () => {
    const payload = classData.students.flatMap((student) =>
      student.scores.flatMap((current) => {
        const key = `${student.studentId}:${current.componentId}`;
        const value =
          scores[key] ?? (current.score === null ? "" : String(current.score));
        return value === ""
          ? []
          : [
              {
                componentId: current.componentId,
                expectedVersion: current.version,
                score: Number(value),
                studentId: student.studentId,
              },
            ];
      })
    );
    save.mutate({ classSectionId, scores: payload });
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassNames[classData.status]}`}
          >
            {statusLabels[classData.status]}
          </span>
        }
        description="Isi nilai komponen, periksa pratinjau, lalu ajukan dan kunci nilai kelas."
        eyebrow={`Nilai · ${classData.courseCode} · ${classData.classCode}`}
        title="Nilai kelas"
      />
      <Card>
        <CardHeader>
          <CardTitle>{classData.courseName}</CardTitle>
          <CardDescription>
            {classData.studentCount} mahasiswa · Bobot komponen tersimpan
            sebagai snapshot kelas.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Daftar nilai mahasiswa</caption>
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="p-3">Mahasiswa</th>
                {classData.components.map((component) => (
                  <th className="p-3" key={component.id}>
                    {component.label} ({component.weight}%)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classData.students.map((student) => (
                <tr className="border-b last:border-0" key={student.studentId}>
                  <th className="p-3 font-medium">
                    <span className="block">{student.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {student.nim}
                    </span>
                  </th>
                  {student.scores.map((current) => {
                    const key = `${student.studentId}:${current.componentId}`;
                    return (
                      <td className="p-3" key={current.componentId}>
                        <Input
                          aria-label={`Nilai ${student.nim}`}
                          disabled={!isDraft}
                          max={100}
                          min={0}
                          onChange={(event) =>
                            setScore(
                              student.studentId,
                              current.componentId,
                              event.target.value
                            )
                          }
                          step="0.01"
                          type="number"
                          value={
                            scores[key] ??
                            (current.score === null
                              ? ""
                              : String(current.score))
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={!isDraft || save.isPending} onClick={saveAll}>
              <Save aria-hidden="true" />{" "}
              {save.isPending ? "Menyimpan..." : "Simpan nilai"}
            </Button>
            <Button
              disabled={!isDraft || submit.isPending}
              onClick={() =>
                submit.mutate({
                  classSectionId,
                  expectedVersion: classData.version,
                })
              }
              variant="outline"
            >
              <Send aria-hidden="true" /> Ajukan nilai
            </Button>
            <Button
              disabled={classData.status !== "SUBMITTED" || lock.isPending}
              onClick={() =>
                lock.mutate({
                  classSectionId,
                  expectedVersion: classData.version,
                })
              }
              variant="outline"
            >
              <LockKeyhole aria-hidden="true" /> Kunci nilai
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface GradePublicationPageProps {
  roleName: string;
}

export const GradePublicationPage = ({
  roleName,
}: GradePublicationPageProps) => {
  const queryClient = useQueryClient();
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const classes = useQuery(
    orpc.grades.classes.list.queryOptions({ input: {} })
  );
  const publish = useMutation(
    orpc.grades.publish.mutationOptions({
      onError: () => toast.error("Nilai belum dapat diterbitkan."),
      onSuccess: async () => {
        toast.success("Nilai diterbitkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.grades.classes.list.key(),
        });
      },
    })
  );
  const publishPeriod = useMutation(
    orpc.grades.publishPeriod.mutationOptions({
      onError: () => toast.error("Publikasi periode belum dapat dimulai."),
      onSuccess: () => toast.success("Publikasi periode selesai diproses."),
    })
  );
  const canPublish = roleName === "Admin Akademik" || roleName === "Superadmin";

  if (classes.isPending) {
    return (
      <GradeState
        title="Memuat publikasi"
        description="Daftar kelas nilai sedang dimuat."
      />
    );
  }
  if (classes.isError || !classes.data) {
    return (
      <GradeState
        title="Publikasi tidak tersedia"
        description="Daftar kelas belum dapat dimuat."
        action={
          <Button onClick={() => classes.refetch()} variant="outline">
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        }
      />
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Tinjau nilai yang sudah dikunci dan terbitkan hasil resmi sesuai lingkup akses."
        eyebrow={`Publikasi nilai · ${roleName}`}
        title="Publikasi nilai"
      />
      <Card>
        <CardHeader>
          <CardTitle>Publikasi satu periode</CardTitle>
          <CardDescription>
            Job publikasi menyimpan progress agar dapat dilanjutkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            aria-label="ID periode akademik"
            onChange={(event) => setAcademicPeriodId(event.target.value)}
            placeholder="ID periode akademik"
            value={academicPeriodId}
          />
          <Button
            disabled={
              !canPublish || !academicPeriodId || publishPeriod.isPending
            }
            onClick={() => publishPeriod.mutate({ academicPeriodId })}
          >
            Terbitkan periode
          </Button>
        </CardContent>
      </Card>
      <section
        aria-label="Daftar kelas nilai"
        className="grid gap-4 md:grid-cols-2"
      >
        {classes.data.map((gradeClass) => (
          <Card key={gradeClass.classSectionId}>
            <CardHeader>
              <CardTitle>
                {gradeClass.courseCode} · {gradeClass.classCode}
              </CardTitle>
              <CardDescription>
                {gradeClass.courseName} · {gradeClass.studentCount} mahasiswa
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassNames[gradeClass.status]}`}
              >
                {statusLabels[gradeClass.status]}
              </span>
              {roleName === "Dosen" ? (
                <a
                  className="text-primary text-sm font-semibold"
                  href={`/dosen/kelas/${gradeClass.classSectionId}/nilai`}
                >
                  Buka daftar nilai
                </a>
              ) : (
                <Button
                  disabled={
                    !canPublish ||
                    gradeClass.status !== "LOCKED" ||
                    publish.isPending
                  }
                  onClick={() =>
                    publish.mutate({
                      classSectionId: gradeClass.classSectionId,
                      expectedVersion: gradeClass.version,
                    })
                  }
                >
                  Terbitkan nilai
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export const StudentGradesPage = ({ periodId }: { periodId?: string }) => {
  const khs = useQuery(
    orpc.grades.student.khs.queryOptions({
      input: { academicPeriodId: periodId },
    })
  );
  const transcript = useQuery(
    orpc.grades.student.transcript.queryOptions({ input: {} })
  );
  if (khs.isPending || transcript.isPending) {
    return (
      <GradeState
        title="Memuat hasil studi"
        description="KHS dan transkrip sedang dimuat."
      />
    );
  }
  if (khs.isError || transcript.isError || !khs.data || !transcript.data) {
    return (
      <GradeState
        title="Hasil studi belum tersedia"
        description="Nilai resmi belum tersedia atau belum dapat dimuat."
        action={
          <Button
            onClick={() => {
              khs.refetch();
              transcript.refetch();
            }}
            variant="outline"
          >
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        }
      />
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Lihat nilai resmi yang telah diterbitkan, IPS, IPK, dan transkrip Anda."
        eyebrow="Hasil studi · Mahasiswa"
        title="Nilai dan KHS"
      />
      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>IPS periode ini</CardDescription>
            <CardTitle>{khs.data.ips.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>IPK kumulatif</CardDescription>
            <CardTitle>{transcript.data.ipk.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>KHS {khs.data.academicPeriodLabel}</CardTitle>
          <CardDescription>
            Hanya nilai dengan status diterbitkan yang ditampilkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GradeResultTable entries={khs.data.entries} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transkrip</CardTitle>
          <CardDescription>
            Daftar nilai terbaik sesuai kebijakan mata kuliah ulang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GradeResultTable entries={transcript.data.entries} />
        </CardContent>
      </Card>
    </div>
  );
};

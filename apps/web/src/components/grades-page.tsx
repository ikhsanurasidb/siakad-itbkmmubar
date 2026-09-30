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
import { LockKeyhole, RefreshCw, Save, Send } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
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

interface GradeResultEntry {
  courseCode: string;
  courseName: string;
  credits: number;
  gradeCode: string;
  gradePoint: number;
  roundedScore: number;
}

interface StudentKhsData {
  academicPeriodLabel: string;
  entries: readonly GradeResultEntry[];
  ips: number;
}

interface StudentTranscriptData {
  entries: readonly GradeResultEntry[];
  ipk: number;
}

const GradeResultTable = ({
  entries,
}: {
  entries: readonly GradeResultEntry[];
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
  view?: "classes" | "period";
}

interface GradeClassRecord {
  classCode: string;
  classSectionId: string;
  courseCode: string;
  courseName: string;
  status: keyof typeof statusLabels;
  studentCount: number;
  version: number;
}

const buildAcademicPeriodOptions = (
  rows: readonly Record<string, unknown>[]
): SearchableSelectOption[] =>
  rows.flatMap((period) => {
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

const GradePeriodPublication = ({
  canPublish,
  isPending,
  onPublish,
  options,
  status,
  value,
  onValueChange,
}: {
  canPublish: boolean;
  isPending: boolean;
  onPublish: () => void;
  onValueChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  status: SearchableSelectStatus;
  value: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Publikasi satu periode</CardTitle>
      <CardDescription>
        Job publikasi menyimpan progress agar dapat dilanjutkan.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-wrap items-start gap-3">
      <div className="min-w-64 flex-1">
        <SearchableSelect
          id="grade-publication-academic-period"
          label="Periode akademik"
          onValueChange={onValueChange}
          options={options}
          placeholder="Cari periode akademik"
          status={status}
          value={value}
        />
      </div>
      <Button
        disabled={
          !canPublish ||
          !options.some((option) => option.value === value) ||
          isPending
        }
        onClick={onPublish}
      >
        Terbitkan periode
      </Button>
    </CardContent>
  </Card>
);

const GradeClassPublicationList = ({
  classes,
  canPublish,
  isPending,
  onPublish,
  roleName,
}: {
  canPublish: boolean;
  classes: readonly GradeClassRecord[];
  isPending: boolean;
  onPublish: (classSectionId: string, expectedVersion: number) => void;
  roleName: string;
}) => (
  <section
    aria-label="Daftar kelas nilai"
    className="grid gap-4 md:grid-cols-2"
  >
    {classes.map((gradeClass) => (
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
                !canPublish || gradeClass.status !== "LOCKED" || isPending
              }
              onClick={() =>
                onPublish(gradeClass.classSectionId, gradeClass.version)
              }
            >
              Terbitkan nilai
            </Button>
          )}
        </CardContent>
      </Card>
    ))}
  </section>
);

const GradePeriodPublicationPage = ({ roleName }: { roleName: string }) => {
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const academicPeriods = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "ACADEMIC_PERIOD", limit: 100, status: "ACTIVE" },
    })
  );
  const publishPeriod = useMutation(
    orpc.grades.publishPeriod.mutationOptions({
      onError: () => toast.error("Publikasi periode belum dapat dimulai."),
      onSuccess: () => toast.success("Publikasi periode selesai diproses."),
    })
  );
  const canPublish = roleName === "Admin Akademik" || roleName === "Superadmin";
  const periodOptions = buildAcademicPeriodOptions(
    academicPeriods.data?.data ?? []
  );

  if (academicPeriods.isPending) {
    return (
      <GradeState
        description="Daftar periode akademik sedang dimuat."
        title="Memuat periode"
      />
    );
  }
  if (academicPeriods.isError || !academicPeriods.data) {
    return (
      <GradeState
        action={
          <Button onClick={() => academicPeriods.refetch()} variant="outline">
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        }
        description="Daftar periode akademik belum dapat dimuat."
        title="Periode tidak tersedia"
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Terbitkan hasil nilai untuk satu periode akademik secara terkontrol."
        eyebrow={`Periode nilai · ${roleName}`}
        title="Periode nilai"
      />
      <GradePeriodPublication
        canPublish={canPublish}
        isPending={publishPeriod.isPending}
        onPublish={() => publishPeriod.mutate({ academicPeriodId })}
        onValueChange={setAcademicPeriodId}
        options={periodOptions}
        status={getSelectStatus(
          academicPeriods.isPending,
          academicPeriods.isError
        )}
        value={academicPeriodId}
      />
    </div>
  );
};

const GradeClassesPublicationPage = ({ roleName }: { roleName: string }) => {
  const queryClient = useQueryClient();
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
      <GradeClassPublicationList
        canPublish={canPublish}
        classes={classes.data}
        isPending={publish.isPending}
        onPublish={(classSectionId, expectedVersion) =>
          publish.mutate({ classSectionId, expectedVersion })
        }
        roleName={roleName}
      />
    </div>
  );
};

export const GradePublicationPage = ({
  roleName,
  view = "classes",
}: GradePublicationPageProps) =>
  view === "period" ? (
    <GradePeriodPublicationPage roleName={roleName} />
  ) : (
    <GradeClassesPublicationPage roleName={roleName} />
  );

interface StudentGradesPageProps {
  periodId?: string;
  view?: "grades" | "khs" | "transcript";
}

const studentGradesViewCopy = {
  grades: {
    description: "Lihat nilai resmi, IPS, dan KHS Anda.",
    errorDescription: "KHS belum dapat dimuat.",
    errorTitle: "KHS belum tersedia",
    eyebrow: "Nilai · Mahasiswa",
    loadingDescription: "Data KHS sedang dimuat.",
    loadingTitle: "Memuat KHS",
    title: "Nilai dan KHS",
  },
  khs: {
    description:
      "Lihat hasil studi dan IPS pada periode akademik yang dipilih.",
    errorDescription: "KHS belum dapat dimuat.",
    errorTitle: "KHS belum tersedia",
    eyebrow: "KHS · Mahasiswa",
    loadingDescription: "Data KHS sedang dimuat.",
    loadingTitle: "Memuat KHS",
    title: "KHS",
  },
  transcript: {
    description:
      "Lihat seluruh nilai terbaik Anda sesuai kebijakan mata kuliah ulang.",
    errorDescription: "Transkrip belum dapat dimuat.",
    errorTitle: "Transkrip belum tersedia",
    eyebrow: "Transkrip · Mahasiswa",
    loadingDescription: "Data transkrip sedang dimuat.",
    loadingTitle: "Memuat transkrip",
    title: "Transkrip",
  },
} as const;

const StudentGradeSummary = ({
  khsData,
  transcriptData,
}: {
  khsData: StudentKhsData;
  transcriptData: StudentTranscriptData;
}) => (
  <section className="grid gap-4 sm:grid-cols-2">
    <Card>
      <CardHeader>
        <CardDescription>IPS periode ini</CardDescription>
        <CardTitle>{khsData.ips.toFixed(2)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader>
        <CardDescription>IPK kumulatif</CardDescription>
        <CardTitle>{transcriptData.ipk.toFixed(2)}</CardTitle>
      </CardHeader>
    </Card>
  </section>
);

const StudentKhsMetric = ({ data }: { data: StudentKhsData }) => (
  <Card>
    <CardHeader>
      <CardDescription>IPS periode ini</CardDescription>
      <CardTitle>{data.ips.toFixed(2)}</CardTitle>
    </CardHeader>
  </Card>
);

const StudentTranscriptMetric = ({ data }: { data: StudentTranscriptData }) => (
  <Card>
    <CardHeader>
      <CardDescription>IPK kumulatif</CardDescription>
      <CardTitle>{data.ipk.toFixed(2)}</CardTitle>
    </CardHeader>
  </Card>
);

const StudentKhsCard = ({ data }: { data: StudentKhsData }) => (
  <Card>
    <CardHeader>
      <CardTitle>KHS {data.academicPeriodLabel}</CardTitle>
      <CardDescription>
        Hanya nilai dengan status diterbitkan yang ditampilkan.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <GradeResultTable entries={data.entries} />
    </CardContent>
  </Card>
);

const StudentTranscriptCard = ({ data }: { data: StudentTranscriptData }) => (
  <Card>
    <CardHeader>
      <CardTitle>Transkrip</CardTitle>
      <CardDescription>
        Daftar nilai terbaik sesuai kebijakan mata kuliah ulang.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <GradeResultTable entries={data.entries} />
    </CardContent>
  </Card>
);

const StudentGradesContent = ({
  khsData,
  transcriptData,
  view,
}: {
  khsData?: StudentKhsData;
  transcriptData?: StudentTranscriptData;
  view: keyof typeof studentGradesViewCopy;
}) => {
  const viewCopy = studentGradesViewCopy[view];

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description={viewCopy.description}
        eyebrow={viewCopy.eyebrow}
        title={viewCopy.title}
      />
      {view === "grades" && khsData && transcriptData ? (
        <StudentGradeSummary
          khsData={khsData}
          transcriptData={transcriptData}
        />
      ) : null}
      {view === "khs" && khsData ? <StudentKhsMetric data={khsData} /> : null}
      {view === "transcript" && transcriptData ? (
        <StudentTranscriptMetric data={transcriptData} />
      ) : null}
      {view !== "transcript" && khsData ? (
        <StudentKhsCard data={khsData} />
      ) : null}
      {view !== "khs" && transcriptData ? (
        <StudentTranscriptCard data={transcriptData} />
      ) : null}
    </div>
  );
};

export const StudentGradesPage = ({
  periodId,
  view = "grades",
}: StudentGradesPageProps) => {
  const showKhs = view !== "transcript";
  const showTranscript = view !== "khs";
  const viewCopy = studentGradesViewCopy[view];
  const khs = useQuery({
    ...orpc.grades.student.khs.queryOptions({
      input: { academicPeriodId: periodId },
    }),
    enabled: showKhs,
  });
  const transcript = useQuery({
    ...orpc.grades.student.transcript.queryOptions({ input: {} }),
    enabled: showTranscript,
  });

  if ((showKhs && khs.isPending) || (showTranscript && transcript.isPending)) {
    return (
      <GradeState
        description={viewCopy.loadingDescription}
        title={viewCopy.loadingTitle}
      />
    );
  }

  if (
    (showKhs && (khs.isError || !khs.data)) ||
    (showTranscript && (transcript.isError || !transcript.data))
  ) {
    return (
      <GradeState
        action={
          <Button
            onClick={() => {
              if (showKhs) {
                khs.refetch();
              }
              if (showTranscript) {
                transcript.refetch();
              }
            }}
            variant="outline"
          >
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        }
        description={viewCopy.errorDescription}
        title={viewCopy.errorTitle}
      />
    );
  }

  const khsData = khs.data;
  const transcriptData = transcript.data;
  return (
    <StudentGradesContent
      khsData={khsData}
      transcriptData={transcriptData}
      view={view}
    />
  );
};

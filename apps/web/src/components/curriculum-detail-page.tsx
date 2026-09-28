import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  curriculumRoutePaths,
  curriculumStatusClassNames,
  curriculumStatusLabels,
  formatCurriculumDate,
} from "@/components/curriculum-ui";
import type { CurriculumBasePath } from "@/components/curriculum-ui";
import { ENV } from "@/env.public";
import { orpc } from "@/utils/orpc";

interface CurriculumDetailPageProps {
  basePath: CurriculumBasePath;
  canManage: boolean;
  curriculumId: string;
  roleName: string;
}

const encodeFile = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

const CurriculumDetailPage = ({
  basePath,
  canManage,
  curriculumId,
  roleName,
}: CurriculumDetailPageProps) => {
  const queryClient = useQueryClient();
  const detail = useQuery(
    orpc.curriculum.detail.queryOptions({ input: { curriculumId } })
  );
  const activate = useMutation(
    orpc.curriculum.activate.mutationOptions({
      onError: () => toast.error("Kurikulum belum dapat diaktifkan."),
      onSuccess: async () => {
        toast.success("Kurikulum diaktifkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.detail.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.list.key(),
        });
      },
    })
  );
  const archive = useMutation(
    orpc.curriculum.archive.mutationOptions({
      onError: () => toast.error("Kurikulum belum dapat diarsipkan."),
      onSuccess: async () => {
        toast.success("Kurikulum diarsipkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.detail.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.curriculum.list.key(),
        });
      },
    })
  );
  const uploadDocument = useMutation(
    orpc.curriculum.documents.upload.mutationOptions({
      onError: () => toast.error("Dokumen belum dapat diunggah."),
      onSuccess: async () => {
        toast.success("Dokumen kurikulum diunggah.");
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
          description="Detail kurikulum sedang dimuat."
          title="Memuat kurikulum"
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
          description="Detail kurikulum belum dapat dimuat. Coba lagi atau periksa akses Anda."
          title="Kurikulum tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const curriculum = detail.data;
  const { assessment: assessmentRoute, structure: structureRoute } =
    curriculumRoutePaths[basePath];
  const isDraft = curriculum.status === "DRAFT";
  const completeAssessmentCount = curriculum.assessments.filter(
    (assessment) =>
      assessment.components.reduce((total, item) => total + item.weight, 0) ===
      100
  ).length;
  const handleFileChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    try {
      uploadDocument.mutate({
        contentBase64: await encodeFile(file),
        curriculumId,
        declaredMime: file.type || undefined,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    } catch {
      toast.error("Dokumen belum dapat dibaca.");
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Link to={basePath}>
            <Button variant="outline">
              <ArrowLeft aria-hidden="true" />
              Kembali ke kurikulum
            </Button>
          </Link>
        }
        description={`${curriculum.studyProgram.code} · ${curriculum.studyProgram.name} · Angkatan ${curriculum.cohort.entryYear}`}
        eyebrow={`Kurikulum · ${roleName}`}
        title={curriculum.name}
      />

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Ringkasan kurikulum"
      >
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Status</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${curriculumStatusClassNames[curriculum.status]}`}
          >
            {curriculumStatusLabels[curriculum.status]}
          </span>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Mata kuliah</p>
          <p className="mt-2 text-2xl font-semibold text-[#102d4d]">
            {curriculum.courses.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Komponen lengkap</p>
          <p className="mt-2 text-2xl font-semibold text-[#102d4d]">
            {completeAssessmentCount}/{curriculum.assessments.length}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kelola kurikulum</CardTitle>
            <CardDescription>
              Struktur dan komponen nilai disimpan sebagai bagian dari versi
              kurikulum ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link params={{ curriculumId }} to={structureRoute}>
              <Button variant="outline">
                <Pencil aria-hidden="true" />
                Atur struktur
              </Button>
            </Link>
            <Link params={{ curriculumId }} to={assessmentRoute}>
              <Button variant="outline">
                <Pencil aria-hidden="true" />
                Atur komponen nilai
              </Button>
            </Link>
            {canManage && isDraft ? (
              <Button
                disabled={activate.isPending}
                onClick={() => activate.mutate({ curriculumId })}
              >
                <CheckCircle2 aria-hidden="true" />
                {activate.isPending ? "Mengaktifkan..." : "Aktifkan kurikulum"}
              </Button>
            ) : null}
            {canManage && curriculum.status === "ACTIVE" ? (
              <Button
                disabled={archive.isPending}
                onClick={() => archive.mutate({ curriculumId })}
                variant="outline"
              >
                {archive.isPending ? "Mengarsipkan..." : "Arsipkan kurikulum"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dokumen kurikulum</CardTitle>
            <CardDescription>
              Dokumen disimpan privat dan hanya dapat diakses melalui
              pemeriksaan izin.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManage && isDraft ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="sr-only" htmlFor="curriculum-document-upload">
                  Unggah dokumen kurikulum
                </label>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full max-w-sm text-sm"
                  disabled={uploadDocument.isPending}
                  id="curriculum-document-upload"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0])
                  }
                  type="file"
                />
                {uploadDocument.isPending ? (
                  <span className="text-sm text-[#71859c]">Mengunggah...</span>
                ) : (
                  <Upload
                    aria-hidden="true"
                    className="size-4 text-[#71859c]"
                  />
                )}
              </div>
            ) : null}
            {curriculum.documents.length === 0 ? (
              <p className="text-sm text-[#71859c]">
                Belum ada dokumen kurikulum.
              </p>
            ) : (
              curriculum.documents.map((document) => (
                <div
                  className="flex items-center gap-3 rounded-xl border border-[#dbe5ee] p-3"
                  key={document.id}
                >
                  <FileText
                    aria-hidden="true"
                    className="size-5 text-[#0b63b6]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {document.filename}
                    </p>
                    <p className="text-xs text-[#71859c]">
                      {document.mimeType} ·{" "}
                      {Math.ceil(document.sizeBytes / 1024)} KB
                    </p>
                  </div>
                  <a
                    className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#0b63b6]"
                    href={`${ENV.VITE_SERVER_URL.replace(/\/$/u, "")}/api/curriculum/${curriculumId}/document`}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Unduh
                  </a>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-[#cfe1ef] bg-[#f4f9fd] p-4 text-sm text-[#214e70]">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>
          Dibuat {formatCurriculumDate.format(new Date(curriculum.createdAt))}.
          Kurikulum aktif menjadi acuan versi berikutnya tanpa mengubah snapshot
          akademik yang sudah terbentuk.
        </p>
      </div>
    </div>
  );
};

export default CurriculumDetailPage;

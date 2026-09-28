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
import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  formatStudyPlanDate,
  studyPlanStatusClassNames,
  studyPlanStatusLabels,
} from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

interface StudyPlanDetailPageProps {
  basePath:
    | "/admin-akademik/krs"
    | "/kaprodi/krs"
    | "/mahasiswa/krs"
    | "/superadmin/krs";
  canManage: boolean;
  studyPlanId: string;
}

const StudyPlanDetailPage = ({
  basePath,
  canManage,
  studyPlanId,
}: StudyPlanDetailPageProps) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const detail = useQuery(
    orpc.studyPlan.detail.queryOptions({ input: { studyPlanId } })
  );
  const finalize = useMutation(
    orpc.studyPlan.finalize.mutationOptions({
      onError: () => toast.error("KRS belum dapat difinalisasi."),
      onSuccess: async () => {
        toast.success("KRS difinalisasi.");
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.detail.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.list.key(),
        });
      },
    })
  );
  const reopen = useMutation(
    orpc.studyPlan.reopen.mutationOptions({
      onError: () => toast.error("KRS belum dapat dibuka kembali."),
      onSuccess: async () => {
        setReason("");
        toast.success("KRS dibuka kembali sebagai draft.");
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.detail.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.studyPlan.list.key(),
        });
      },
    })
  );

  if (detail.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <State
          description="Detail KRS sedang dimuat."
          title="Memuat KRS"
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
          description="Detail KRS belum dapat dimuat. Coba lagi atau periksa akses Anda."
          title="KRS tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const plan = detail.data;
  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          <Link to={basePath}>
            <Button variant="outline">
              <ArrowLeft aria-hidden="true" />
              Kembali ke KRS
            </Button>
          </Link>
        }
        description={`${plan.student.nim} · Periode ${formatStudyPlanDate.format(new Date(plan.academicPeriod.startDate))}–${formatStudyPlanDate.format(new Date(plan.academicPeriod.endDate))}`}
        eyebrow="KRS Paket"
        title={plan.student.name}
      />
      <section aria-label="Ringkasan KRS" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Status</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${studyPlanStatusClassNames[plan.status]}`}
          >
            {studyPlanStatusLabels[plan.status]}
          </span>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Mata kuliah</p>
          <p className="mt-2 text-2xl font-semibold text-[#102d4d]">
            {plan.totalCourses}
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbe5ee] bg-white p-5">
          <p className="text-xs font-medium text-[#71859c]">Total SKS</p>
          <p className="mt-2 text-2xl font-semibold text-[#102d4d]">
            {plan.totalCredits}
          </p>
        </div>
      </section>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Aksi KRS</CardTitle>
            <CardDescription>
              Finalisasi mengunci KRS untuk digunakan pada pemetaan kelas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:flex sm:items-end">
            {plan.status === "DRAFT" ? (
              <Button
                disabled={finalize.isPending}
                onClick={() => finalize.mutate({ studyPlanId })}
              >
                {finalize.isPending ? "Memfinalisasi..." : "Finalisasi KRS"}
              </Button>
            ) : (
              <>
                <label
                  className="grid gap-1.5 text-sm font-medium"
                  htmlFor="study-plan-reopen-reason"
                >
                  Alasan membuka kembali
                  <Input
                    id="study-plan-reopen-reason"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Contoh: Perubahan kurikulum pada periode ini"
                    value={reason}
                  />
                </label>
                <Button
                  disabled={reopen.isPending || reason.trim().length < 10}
                  onClick={() => reopen.mutate({ reason, studyPlanId })}
                  variant="outline"
                >
                  {reopen.isPending
                    ? "Membuka..."
                    : "Buka kembali sebagai draft"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Daftar mata kuliah</CardTitle>
          <CardDescription>
            KRS Paket bersifat read-only untuk mahasiswa.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">Mata kuliah pada KRS</caption>
            <thead>
              <tr className="border-b text-xs tracking-wide text-[#71859c] uppercase">
                <th className="px-3 py-3">Semester</th>
                <th className="px-3 py-3">Kode</th>
                <th className="px-3 py-3">Mata kuliah</th>
                <th className="px-3 py-3">SKS</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((item) => (
                <tr className="border-b last:border-0" key={item.id}>
                  <td className="px-3 py-3">{item.semester}</td>
                  <td className="px-3 py-3 font-medium">{item.courseCode}</td>
                  <td className="px-3 py-3">{item.courseName}</td>
                  <td className="px-3 py-3">{item.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyPlanDetailPage;

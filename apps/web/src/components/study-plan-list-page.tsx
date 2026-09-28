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
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText, Plus, RefreshCw } from "lucide-react";

import {
  formatStudyPlanDateTime,
  studyPlanModeLabels,
  studyPlanStatusClassNames,
  studyPlanStatusLabels,
} from "@/components/study-plan-ui";
import { orpc } from "@/utils/orpc";

interface StudyPlanListPageProps {
  basePath: "/admin-akademik/krs" | "/kaprodi/krs" | "/mahasiswa/krs";
  canGenerate: boolean;
  roleName: string;
}

const StudyPlanListPage = ({
  basePath,
  canGenerate,
  roleName,
}: StudyPlanListPageProps) => {
  const plans = useQuery(orpc.studyPlan.list.queryOptions({ input: {} }));

  if (plans.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Lihat KRS Paket sesuai lingkup akses Anda."
          eyebrow={`KRS Paket · ${roleName}`}
          title={roleName === "Mahasiswa" ? "KRS semester ini" : "KRS Paket"}
        />
        <State
          description="Daftar KRS sedang dimuat."
          title="Memuat KRS"
          variant="loading"
        />
      </div>
    );
  }

  if (plans.isError || !plans.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Lihat KRS Paket sesuai lingkup akses Anda."
          eyebrow={`KRS Paket · ${roleName}`}
          title="KRS Paket"
        />
        <State
          action={
            <Button onClick={() => plans.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Daftar KRS belum dapat dimuat. Coba lagi atau periksa koneksi."
          title="KRS tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        action={
          canGenerate ? (
            <Link to="/admin-akademik/krs/generate">
              <Button>
                <Plus aria-hidden="true" />
                Buat KRS Paket
              </Button>
            </Link>
          ) : undefined
        }
        description={
          roleName === "Mahasiswa"
            ? "Lihat mata kuliah yang ditetapkan untuk periode akademik Anda."
            : "Tinjau, finalisasi, dan telusuri KRS Paket sesuai lingkup akses Anda."
        }
        eyebrow={`KRS Paket · ${roleName}`}
        title={roleName === "Mahasiswa" ? "KRS semester ini" : "KRS Paket"}
      />
      {plans.data.length === 0 ? (
        <Card>
          <State
            description={
              roleName === "Mahasiswa"
                ? "KRS semester aktif belum difinalisasi oleh Admin Akademik."
                : "Buat KRS Paket untuk menyiapkan input Kelas Kuliah."
            }
            title={
              roleName === "Mahasiswa" ? "KRS belum tersedia" : "Belum ada KRS"
            }
            variant="not-found"
          />
        </Card>
      ) : (
        <section aria-label="Daftar KRS" className="grid gap-4 md:grid-cols-2">
          {plans.data.map((plan) => (
            <Card className="border-[#dbe5ee]" key={plan.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0b63b6]">
                    <FileText aria-hidden="true" className="size-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${studyPlanStatusClassNames[plan.status]}`}
                  >
                    {studyPlanStatusLabels[plan.status]}
                  </span>
                </div>
                <CardTitle>{plan.student.name}</CardTitle>
                <CardDescription>
                  {plan.student.nim} · {studyPlanModeLabels[plan.mode]} ·{" "}
                  {plan.academicPeriod.term}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-[#71859c]">
                  {plan.totalCourses} mata kuliah · {plan.totalCredits} SKS ·
                  Diperbarui{" "}
                  {formatStudyPlanDateTime.format(new Date(plan.updatedAt))}
                </p>
                <a
                  className="shrink-0 text-sm font-semibold text-[#0b63b6]"
                  href={`${basePath}/${plan.id}`}
                >
                  Lihat KRS
                </a>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default StudyPlanListPage;

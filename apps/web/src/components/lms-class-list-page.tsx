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
import { BookOpen, RefreshCw } from "lucide-react";

import { orpc } from "@/utils/orpc";

interface LmsClassListPageProps {
  roleName: "Dosen" | "Mahasiswa";
}

const LmsClassListPage = ({ roleName }: LmsClassListPageProps) => {
  const sections = useQuery(
    orpc.scheduling.sections.list.queryOptions({ input: {} })
  );
  const basePath =
    roleName === "Dosen"
      ? "/dosen/kelas/$classId/lms"
      : "/mahasiswa/kelas/$classId/lms";

  if (sections.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buka ruang pembelajaran setiap kelas."
          eyebrow={`LMS · ${roleName}`}
          title="Ruang pembelajaran"
        />
        <State
          description="Daftar kelas sedang dimuat."
          title="Memuat kelas"
          variant="loading"
        />
      </div>
    );
  }

  if (sections.isError || !sections.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Buka ruang pembelajaran setiap kelas."
          eyebrow={`LMS · ${roleName}`}
          title="Ruang pembelajaran"
        />
        <State
          action={
            <Button onClick={() => sections.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" /> Coba lagi
            </Button>
          }
          description="Daftar kelas belum dapat dimuat."
          title="LMS tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Materi, tugas, diskusi, dan submission tersedia di ruang kelas masing-masing."
        eyebrow={`LMS · ${roleName}`}
        title="Ruang pembelajaran"
      />
      {sections.data.length === 0 ? (
        <Card>
          <State
            description="Belum ada kelas yang dapat diakses."
            title="Belum ada kelas"
            variant="not-found"
          />
        </Card>
      ) : (
        <section
          aria-label="Daftar kelas LMS"
          className="grid gap-4 md:grid-cols-2"
        >
          {sections.data.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="grid size-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0b63b6]">
                  <BookOpen aria-hidden="true" className="size-5" />
                </div>
                <CardTitle>
                  {section.courseCode} · {section.code}
                </CardTitle>
                <CardDescription>
                  {section.courseName} ·{" "}
                  {section.lecturerNames.join(", ") || "Dosen belum ditetapkan"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-[#71859c]">
                  {section.enrolledCount} peserta ·{" "}
                  {section.status === "PUBLISHED"
                    ? "Kelas aktif"
                    : "Belum diterbitkan"}
                </p>
                <Link params={{ classId: section.id }} to={basePath}>
                  <Button variant="outline">Buka LMS</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default LmsClassListPage;

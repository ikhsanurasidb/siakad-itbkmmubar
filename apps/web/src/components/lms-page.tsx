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
import { Textarea } from "@siakad-itbkmmubar/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface LmsPageProps {
  classSectionId: string;
  classMeetingId?: string;
  roleName: "Dosen" | "Mahasiswa";
}

interface LmsUpload {
  contentBase64: string;
  filename: string;
  mimeType: string;
}

const formatDate = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const readFiles = (files: FileList | null) => {
  if (!files) {
    return [];
  }
  return Promise.all(
    [...files].slice(0, 5).map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
      }
      return {
        contentBase64: btoa(binary),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
      };
    })
  );
};

// eslint-disable-next-line react-doctor/no-giant-component -- LMS coordinates the classroom tabs and their mutations.
const LmsPage = ({
  classMeetingId,
  classSectionId,
  roleName,
}: LmsPageProps) => {
  const queryClient = useQueryClient();
  const isLecturer = roleName === "Dosen";
  const detail = useQuery(
    orpc.lms.detail.queryOptions({ input: { classMeetingId, classSectionId } })
  );
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialBody, setMaterialBody] = useState("");
  const materialFiles = useRef<LmsUpload[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentBody, setAssignmentBody] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const assignmentFiles = useRef<LmsUpload[]>([]);
  const [submissionBodies, setSubmissionBodies] = useState<
    Record<string, string>
  >({});
  const submissionFiles = useRef<Record<string, LmsUpload[]>>({});
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.lms.detail.key({
        input: { classMeetingId, classSectionId },
      }),
    });
  const createMaterial = useMutation(
    orpc.lms.materials.create.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Materi disimpan sebagai draf.");
        refresh();
        setMaterialTitle("");
        setMaterialBody("");
      },
    })
  );
  const publishMaterial = useMutation(
    orpc.lms.materials.publish.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Materi diterbitkan.");
        refresh();
      },
    })
  );
  const createAssignment = useMutation(
    orpc.lms.assignments.create.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Tugas disimpan sebagai draf.");
        refresh();
        setAssignmentTitle("");
        setAssignmentBody("");
        setAssignmentDueAt("");
      },
    })
  );
  const publishAssignment = useMutation(
    orpc.lms.assignments.publish.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Tugas diterbitkan.");
        refresh();
      },
    })
  );
  const submitAssignment = useMutation(
    orpc.lms.assignments.submit.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Submission berhasil dikirim.");
        refresh();
      },
    })
  );
  const createThread = useMutation(
    orpc.lms.forum.createThread.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Forum dibuat.");
        refresh();
        setThreadTitle("");
        setThreadBody("");
      },
    })
  );
  const createPost = useMutation(
    orpc.lms.forum.createPost.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Balasan dikirim.");
        refresh();
      },
    })
  );
  const closeThread = useMutation(
    orpc.lms.forum.close.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success("Forum ditutup.");
        refresh();
      },
    })
  );

  if (detail.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Materi, tugas, forum, dan submission kelas."
          eyebrow={`LMS · ${roleName}`}
          title="Ruang pembelajaran"
        />
        <State
          description="Konten LMS sedang dimuat."
          title="Memuat LMS"
          variant="loading"
        />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description="Materi, tugas, forum, dan submission kelas."
          eyebrow={`LMS · ${roleName}`}
          title="Ruang pembelajaran"
        />
        <State
          action={
            <Button onClick={() => detail.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" /> Coba lagi
            </Button>
          }
          description="Ruang LMS belum dapat dimuat atau Anda tidak terdaftar pada kelas."
          title="LMS tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description="Materi, tugas, forum, dan submission kelas."
        eyebrow={`LMS · ${roleName}`}
        title="Ruang pembelajaran"
      />
      {isLecturer && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tambah materi</CardTitle>
              <CardDescription>
                Materi baru tersimpan sebagai draf sampai diterbitkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                aria-label="Judul materi"
                onChange={(event) => setMaterialTitle(event.target.value)}
                placeholder="Judul materi"
                value={materialTitle}
              />
              <Textarea
                aria-label="Isi materi"
                onChange={(event) => setMaterialBody(event.target.value)}
                placeholder="Isi atau ringkasan materi"
                value={materialBody}
              />
              <Input
                aria-label="Lampiran materi"
                onChange={async (event) => {
                  materialFiles.current = await readFiles(event.target.files);
                }}
                type="file"
              />
              <Button
                disabled={!materialTitle || createMaterial.isPending}
                onClick={() =>
                  createMaterial.mutate({
                    body: materialBody || undefined,
                    classMeetingId,
                    classSectionId,
                    files: materialFiles.current.length
                      ? materialFiles.current
                      : undefined,
                    title: materialTitle,
                  })
                }
              >
                Simpan materi
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tambah tugas</CardTitle>
              <CardDescription>
                Server menentukan status tepat waktu atau terlambat saat
                submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input
                aria-label="Judul tugas"
                onChange={(event) => setAssignmentTitle(event.target.value)}
                placeholder="Judul tugas"
                value={assignmentTitle}
              />
              <Textarea
                aria-label="Instruksi tugas"
                onChange={(event) => setAssignmentBody(event.target.value)}
                placeholder="Instruksi tugas"
                value={assignmentBody}
              />
              <Input
                aria-label="Batas pengumpulan"
                onChange={(event) => setAssignmentDueAt(event.target.value)}
                type="datetime-local"
                value={assignmentDueAt}
              />
              <Input
                aria-label="Lampiran tugas"
                onChange={async (event) => {
                  assignmentFiles.current = await readFiles(event.target.files);
                }}
                type="file"
              />
              <Button
                disabled={
                  !assignmentTitle ||
                  !assignmentDueAt ||
                  createAssignment.isPending
                }
                onClick={() =>
                  createAssignment.mutate({
                    body: assignmentBody || undefined,
                    classMeetingId,
                    classSectionId,
                    dueAt: new Date(assignmentDueAt),
                    files: assignmentFiles.current.length
                      ? assignmentFiles.current
                      : undefined,
                    title: assignmentTitle,
                  })
                }
              >
                Simpan tugas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <section aria-labelledby="materi-heading" className="grid gap-4">
        <h2 className="text-xl font-semibold" id="materi-heading">
          Materi
        </h2>
        {detail.data.materials.length === 0 ? (
          <Card>
            <State
              description="Belum ada materi pada ruang ini."
              title="Materi belum tersedia"
              variant="not-found"
            />
          </Card>
        ) : (
          detail.data.materials.map((material) => (
            <Card key={material.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{material.title}</CardTitle>
                    <CardDescription>
                      {material.status === "PUBLISHED" ? "Diterbitkan" : "Draf"}{" "}
                      · Diperbarui{" "}
                      {formatDate.format(new Date(material.updatedAt))}
                    </CardDescription>
                  </div>
                  <FileText
                    aria-hidden="true"
                    className="size-5 text-[#0b63b6]"
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="text-sm whitespace-pre-wrap text-[#4f6479]">
                  {material.body || "Tidak ada isi tambahan."}
                </p>
                {isLecturer && material.status === "DRAFT" && (
                  <Button
                    disabled={publishMaterial.isPending}
                    onClick={() =>
                      publishMaterial.mutate({
                        expectedVersion: material.version,
                        materialId: material.id,
                      })
                    }
                  >
                    Terbitkan materi
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section aria-labelledby="tugas-heading" className="grid gap-4">
        <h2 className="text-xl font-semibold" id="tugas-heading">
          Tugas
        </h2>
        {detail.data.assignments.length === 0 ? (
          <Card>
            <State
              description="Belum ada tugas pada ruang ini."
              title="Tugas belum tersedia"
              variant="not-found"
            />
          </Card>
        ) : (
          detail.data.assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <CardTitle>{assignment.title}</CardTitle>
                <CardDescription>
                  {assignment.status === "PUBLISHED" ? "Diterbitkan" : "Draf"} ·
                  Batas {formatDate.format(new Date(assignment.dueAt))}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="text-sm whitespace-pre-wrap text-[#4f6479]">
                  {assignment.body || "Tidak ada instruksi tambahan."}
                </p>
                {isLecturer && assignment.status === "DRAFT" && (
                  <Button
                    disabled={publishAssignment.isPending}
                    onClick={() =>
                      publishAssignment.mutate({
                        assignmentId: assignment.id,
                        expectedVersion: assignment.version,
                      })
                    }
                  >
                    Terbitkan tugas
                  </Button>
                )}
                {!isLecturer && (
                  <>
                    <Textarea
                      aria-label={`Submission ${assignment.title}`}
                      onChange={(event) =>
                        setSubmissionBodies((current) => ({
                          ...current,
                          [assignment.id]: event.target.value,
                        }))
                      }
                      placeholder="Tulis jawaban atau catatan submission"
                      value={submissionBodies[assignment.id] ?? ""}
                    />
                    <Input
                      aria-label={`Lampiran submission ${assignment.title}`}
                      onChange={async (event) => {
                        const files = await readFiles(event.target.files);
                        submissionFiles.current[assignment.id] = files;
                      }}
                      type="file"
                    />
                    <Button
                      disabled={
                        !submissionBodies[assignment.id] ||
                        submitAssignment.isPending
                      }
                      onClick={() =>
                        submitAssignment.mutate({
                          assignmentId: assignment.id,
                          body: submissionBodies[assignment.id],
                          files: submissionFiles.current[assignment.id]?.length
                            ? submissionFiles.current[assignment.id]
                            : undefined,
                        })
                      }
                    >
                      <Send aria-hidden="true" /> Kirim submission
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section aria-labelledby="forum-heading" className="grid gap-4">
        <div className="flex items-center gap-2">
          <MessageCircle aria-hidden="true" className="size-5 text-[#0b63b6]" />
          <h2 className="text-xl font-semibold" id="forum-heading">
            Forum kelas
          </h2>
        </div>
        <Card>
          <CardContent className="grid gap-3 pt-6">
            <Input
              aria-label="Judul forum"
              onChange={(event) => setThreadTitle(event.target.value)}
              placeholder="Judul diskusi"
              value={threadTitle}
            />
            <Textarea
              aria-label="Isi forum"
              onChange={(event) => setThreadBody(event.target.value)}
              placeholder="Mulai diskusi atau ajukan pertanyaan"
              value={threadBody}
            />
            <Button
              disabled={!threadTitle || !threadBody || createThread.isPending}
              onClick={() =>
                createThread.mutate({
                  body: threadBody,
                  classSectionId,
                  title: threadTitle,
                })
              }
            >
              Buat forum
            </Button>
          </CardContent>
        </Card>
        {detail.data.threads.map((thread) => (
          <Card key={thread.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{thread.title}</CardTitle>
                  <CardDescription>
                    {thread.status === "OPEN" ? "Terbuka" : "Ditutup"} ·{" "}
                    {thread.posts.length} pesan
                  </CardDescription>
                </div>
                {isLecturer && thread.status === "OPEN" && (
                  <Button
                    onClick={() => closeThread.mutate({ threadId: thread.id })}
                    variant="outline"
                  >
                    Tutup forum
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {thread.posts.map((post) => (
                <div className="rounded-xl bg-[#f5f8fb] p-3" key={post.id}>
                  <p className="text-sm whitespace-pre-wrap">{post.body}</p>
                  <p className="mt-2 text-xs text-[#71859c]">
                    {formatDate.format(new Date(post.createdAt))}
                  </p>
                </div>
              ))}
              {thread.status === "OPEN" && (
                <div className="flex gap-2">
                  <Input
                    aria-label={`Balasan ${thread.title}`}
                    onChange={(event) =>
                      setReplyBodies((current) => ({
                        ...current,
                        [thread.id]: event.target.value,
                      }))
                    }
                    placeholder="Tulis balasan"
                    value={replyBodies[thread.id] ?? ""}
                  />
                  <Button
                    disabled={!replyBodies[thread.id] || createPost.isPending}
                    onClick={() =>
                      createPost.mutate({
                        body: replyBodies[thread.id],
                        threadId: thread.id,
                      })
                    }
                  >
                    Balas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default LmsPage;

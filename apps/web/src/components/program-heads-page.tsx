import type { ProgramHeadRecord } from "@siakad-itbkmmubar/api/identity";
import {
  getDatePartsInTimeZone,
  parseLocalDateTime,
} from "@siakad-itbkmmubar/api/time-zone";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { ConfirmationDialog } from "@siakad-itbkmmubar/ui/components/confirmation-dialog";
import { DataTable } from "@siakad-itbkmmubar/ui/components/data-table";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { ENV } from "@/env.public";
import { orpc } from "@/utils/orpc";

interface ProgramHeadPageProps {
  description: string;
  eyebrow: string;
  title: string;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: ENV.VITE_BUSINESS_TIME_ZONE,
});

const formatDate = (value: Date): string =>
  dateFormatter.format(new Date(value));

const todayInputValue = (): string => {
  const { day, month, year } = getDatePartsInTimeZone(
    new Date(),
    ENV.VITE_BUSINESS_TIME_ZONE
  );
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const dateAtBusinessMidnight = (value: string): Date =>
  parseLocalDateTime(value, ENV.VITE_BUSINESS_TIME_ZONE);

const recordText = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const isActiveAssignment = (
  assignment: ProgramHeadRecord,
  currentTime: number
): boolean =>
  new Date(assignment.startsAt).getTime() <= currentTime &&
  (assignment.endsAt === null ||
    new Date(assignment.endsAt).getTime() > currentTime);

const getAssignmentStatus = (
  assignment: ProgramHeadRecord,
  currentTime: number
): string => {
  if (isActiveAssignment(assignment, currentTime)) {
    return "Aktif";
  }
  if (new Date(assignment.startsAt).getTime() > currentTime) {
    return "Akan datang";
  }
  return "Berakhir";
};

interface ProgramHeadTableRow extends ProgramHeadRecord {
  handleEnd: () => void;
  isCurrent: boolean;
  periode: string;
  status: string;
}

const ProgramHeadAction = ({ onEnd: handleEnd }: { onEnd: () => void }) => (
  <Button onClick={handleEnd} size="sm" type="button" variant="outline">
    Akhiri
  </Button>
);

const renderProgramHeadAction = (row: ProgramHeadTableRow): ReactNode =>
  row.isCurrent ? <ProgramHeadAction onEnd={row.handleEnd} /> : null;

const useCurrentTime = (): number => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(
      () => setCurrentTime(Date.now()),
      60_000
    );
    return () => window.clearInterval(intervalId);
  }, []);
  return currentTime;
};

const ProgramHeadsPage = ({
  description,
  eyebrow,
  title,
}: ProgramHeadPageProps) => {
  const queryClient = useQueryClient();
  const [dosenId, setDosenId] = useState("");
  const [prodiId, setProdiId] = useState("");
  const [startsAt, setStartsAt] = useState(todayInputValue);
  const [endsAt, setEndsAt] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [assignmentToEnd, setAssignmentToEnd] =
    useState<ProgramHeadRecord | null>(null);
  const currentTime = useCurrentTime();

  const accounts = useQuery(
    orpc.identity.accounts.list.queryOptions({
      input: { identityType: "DOSEN", limit: 100, status: "ACTIVE" },
    })
  );
  const programs = useQuery(
    orpc.masterData.list.queryOptions({
      input: { entityType: "STUDY_PROGRAM", limit: 100, status: "ACTIVE" },
    })
  );
  const assignments = useQuery(orpc.identity.programHeads.list.queryOptions());
  const assignProgramHead = useMutation(
    orpc.identity.programHeads.assign.mutationOptions({
      onError: () => {
        toast.error(
          "Penugasan belum dapat disimpan. Periksa dosen, prodi, dan periode."
        );
      },
      onSuccess: async () => {
        setDosenId("");
        setProdiId("");
        setStartsAt(todayInputValue());
        setEndsAt("");
        setHasSubmitted(false);
        toast.success("Kaprodi ditetapkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.identity.programHeads.list.key(),
        });
      },
    })
  );
  const endProgramHead = useMutation(
    orpc.identity.programHeads.end.mutationOptions({
      onError: () => toast.error("Penugasan belum dapat diakhiri. Coba lagi."),
      onSuccess: async () => {
        setAssignmentToEnd(null);
        toast.success("Penugasan Kaprodi diakhiri.");
        await queryClient.invalidateQueries({
          queryKey: orpc.identity.programHeads.list.key(),
        });
      },
    })
  );

  const dosenOptions = accounts.data ?? [];
  const prodiOptions = useMemo(
    () =>
      (programs.data?.data ?? []).flatMap((row) => {
        const id = recordText(row, "id");
        const code = recordText(row, "code");
        const name = recordText(row, "name");
        return id && code && name ? [{ code, id, name }] : [];
      }),
    [programs.data?.data]
  );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!dosenId || !prodiId || !startsAt) {
      return;
    }
    if (endsAt && endsAt <= startsAt) {
      toast.error("Tanggal akhir harus setelah tanggal mulai.");
      return;
    }
    assignProgramHead.mutate({
      endsAt: endsAt ? dateAtBusinessMidnight(endsAt) : null,
      prodiId,
      startsAt: dateAtBusinessMidnight(startsAt),
      userId: dosenId,
    });
  };

  const assignmentRows: ProgramHeadTableRow[] = (assignments.data ?? []).map(
    (assignment) => ({
      ...assignment,
      handleEnd: () => setAssignmentToEnd(assignment),
      isCurrent: isActiveAssignment(assignment, currentTime),
      periode: `${formatDate(assignment.startsAt)} – ${assignment.endsAt ? formatDate(assignment.endsAt) : "sekarang"}`,
      status: getAssignmentStatus(assignment, currentTime),
    })
  );

  let content: ReactNode;
  if (assignments.isPending) {
    content = (
      <p className="text-muted-foreground text-sm">Memuat assignment...</p>
    );
  } else if (assignments.isError) {
    content = (
      <p className="text-destructive text-sm" role="alert">
        Assignment belum dapat dimuat. Coba lagi.
      </p>
    );
  } else {
    content = (
      <DataTable
        columns={[
          { header: "Dosen", id: "userName" },
          { header: "Identifier", id: "userIdentifier" },
          {
            cell: (row) => `${row.prodiCode} · ${row.prodiName}`,
            header: "Prodi",
            id: "prodi",
          },
          { header: "Periode", id: "periode" },
          { header: "Status", id: "status" },
          {
            cell: renderProgramHeadAction,
            header: "Aksi",
            id: "action",
          },
        ]}
        getRowKey={(row) => row.id}
        rows={assignmentRows}
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader description={description} eyebrow={eyebrow} title={title} />
      <Card>
        <CardHeader>
          <CardTitle>Tetapkan Kaprodi</CardTitle>
          <CardDescription>
            Pilih Dosen aktif dan Prodi. Peran Kaprodi mengikuti periode
            penugasan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                error={
                  hasSubmitted && !dosenId ? "Dosen wajib dipilih." : undefined
                }
                id="program-head-lecturer"
                label="Dosen aktif"
              >
                <select
                  aria-invalid={hasSubmitted && !dosenId}
                  className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                  disabled={accounts.isPending}
                  id="program-head-lecturer"
                  onChange={(event) => setDosenId(event.target.value)}
                  value={dosenId}
                >
                  <option value="">Pilih dosen</option>
                  {dosenOptions.map((row) => (
                    <option key={row.account.userId} value={row.account.userId}>
                      {row.name} · {row.account.identifier}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                error={
                  hasSubmitted && !prodiId ? "Prodi wajib dipilih." : undefined
                }
                id="program-head-study-program"
                label="Program studi"
              >
                <select
                  aria-invalid={hasSubmitted && !prodiId}
                  className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                  disabled={programs.isPending}
                  id="program-head-study-program"
                  onChange={(event) => setProdiId(event.target.value)}
                  value={prodiId}
                >
                  <option value="">Pilih program studi</option>
                  {prodiOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} · {row.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                helper="Tanggal mulai berlaku."
                id="program-head-start"
                label="Tanggal mulai"
              >
                <Input
                  id="program-head-start"
                  onChange={(event) => setStartsAt(event.target.value)}
                  type="date"
                  value={startsAt}
                />
              </FormField>
              <FormField
                helper="Kosongkan jika belum ditentukan."
                id="program-head-end"
                label="Tanggal akhir"
                optional
              >
                <Input
                  id="program-head-end"
                  onChange={(event) => setEndsAt(event.target.value)}
                  type="date"
                  value={endsAt}
                />
              </FormField>
            </div>
            <div>
              <Button disabled={assignProgramHead.isPending} type="submit">
                {assignProgramHead.isPending
                  ? "Menyimpan..."
                  : "Tetapkan Kaprodi"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assignment Kaprodi</CardTitle>
          <CardDescription>
            Riwayat assignment ditampilkan untuk menjaga jejak administrasi.
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
      <ConfirmationDialog
        confirmLabel="Akhiri assignment"
        onCancel={() => setAssignmentToEnd(null)}
        onConfirm={() => {
          if (assignmentToEnd) {
            endProgramHead.mutate({
              endsAt: new Date(),
              id: assignmentToEnd.id,
            });
          }
        }}
        open={Boolean(assignmentToEnd)}
        title="Akhiri assignment Kaprodi?"
      >
        {assignmentToEnd
          ? `${assignmentToEnd.userName} tidak lagi menjadi Kaprodi ${assignmentToEnd.prodiName} setelah assignment diakhiri.`
          : null}
      </ConfirmationDialog>
    </div>
  );
};

export default ProgramHeadsPage;

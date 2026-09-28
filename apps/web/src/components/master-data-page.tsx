import { studyProgramDegreeOptions } from "@siakad-itbkmmubar/api/master-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import MasterDataCreateForm from "@/components/master-data-create-form";
import type {
  FieldDefinition,
  SuggestionOption,
} from "@/components/master-data-create-form";
import MasterDataListCard from "@/components/master-data-list-card";
import type { MasterDataEntityType } from "@/components/master-data-types";
import { orpc } from "@/utils/orpc";

export type { MasterDataEntityType } from "@/components/master-data-types";

interface MasterDataPageProps {
  description: string;
  entityType: MasterDataEntityType;
  title: string;
}

const definitions: Record<MasterDataEntityType, readonly FieldDefinition[]> = {
  ACADEMIC_PERIOD: [
    { id: "academicYearId", label: "Tahun akademik" },
    { id: "term", label: "Term", type: "text" },
    { id: "startDate", label: "Tanggal mulai", type: "date" },
    { id: "endDate", label: "Tanggal akhir", type: "date" },
  ],
  ACADEMIC_YEAR: [
    { id: "code", label: "Kode" },
    { id: "startYear", label: "Tahun mulai", type: "number" },
    { id: "endYear", label: "Tahun akhir", type: "number" },
  ],
  COHORT: [
    { id: "studyProgramId", label: "Prodi" },
    { id: "entryYear", label: "Tahun masuk", type: "number" },
  ],
  COURSE: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    { id: "credits", label: "SKS", type: "number" },
    {
      id: "defaultSemester",
      label: "Semester",
      optional: true,
      type: "number",
    },
    { id: "studyProgramId", label: "Prodi" },
  ],
  LECTURER: [
    { id: "name", label: "Nama" },
    { id: "nidn", label: "NIDN", optional: true },
    { id: "nuptk", label: "NUPTK", optional: true },
    { id: "email", label: "Email", optional: true, type: "text" },
    { id: "phone", label: "Telepon", optional: true },
  ],
  ROOM: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    { id: "capacity", label: "Kapasitas", type: "number" },
    { id: "latitude", label: "Latitude", type: "number" },
    { id: "longitude", label: "Longitude", type: "number" },
  ],
  STUDENT: [
    { id: "nim", label: "NIM" },
    { id: "name", label: "Nama" },
    { id: "studyProgramId", label: "Prodi" },
    { id: "cohortId", label: "Angkatan" },
    { id: "email", label: "Email", optional: true },
    { id: "phone", label: "Telepon", optional: true },
  ],
  STUDY_PROGRAM: [
    { id: "code", label: "Kode" },
    { id: "name", label: "Nama" },
    {
      id: "degree",
      label: "Jenjang",
      options: studyProgramDegreeOptions,
      type: "select",
    },
  ],
};

const labels: Record<MasterDataEntityType, string> = {
  ACADEMIC_PERIOD: "Periode",
  ACADEMIC_YEAR: "Tahun akademik",
  COHORT: "Angkatan",
  COURSE: "Mata kuliah",
  LECTURER: "Dosen",
  ROOM: "Ruang",
  STUDENT: "Mahasiswa",
  STUDY_PROGRAM: "Prodi",
};

const recordText = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const getErrorMessage = (): string =>
  "Perubahan belum dapat disimpan. Periksa data lalu coba lagi.";

const MasterDataPage = ({
  description,
  entityType,
  title,
}: MasterDataPageProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED" | undefined>();
  const [cursor, setCursor] = useState<string>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [referenceLabels, setReferenceLabels] = useState<
    Record<string, string>
  >({});
  const [referenceSearch, setReferenceSearch] = useState<
    Record<string, string>
  >({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const fields = definitions[entityType];
  const hasStudyProgramReference = ["COHORT", "COURSE", "STUDENT"].includes(
    entityType
  );
  const studyPrograms = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: hasStudyProgramReference,
      input: {
        entityType: "STUDY_PROGRAM",
        limit: 100,
        search: referenceSearch.studyProgramId || undefined,
        status: "ACTIVE",
      },
    })
  );
  const cohorts = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: entityType === "STUDENT",
      input: {
        entityType: "COHORT",
        limit: 100,
        status: "ACTIVE",
      },
    })
  );
  const academicYears = useQuery(
    orpc.masterData.list.queryOptions({
      enabled: entityType === "ACADEMIC_PERIOD",
      input: {
        entityType: "ACADEMIC_YEAR",
        limit: 100,
        search: referenceSearch.academicYearId || undefined,
        status: "ACTIVE",
      },
    })
  );
  const records = useQuery(
    orpc.masterData.list.queryOptions({
      input: {
        cursor,
        entityType,
        limit: 50,
        search: submittedSearch || undefined,
        status,
      },
    })
  );
  const createRecord = useMutation(
    orpc.masterData.create.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async () => {
        setValues({});
        setReferenceLabels({});
        setReferenceSearch({});
        setHasSubmitted(false);
        toast.success(`${labels[entityType]} berhasil ditambahkan.`);
        await queryClient.invalidateQueries({
          queryKey: orpc.masterData.list.key(),
        });
      },
    })
  );
  const archiveRecord = useMutation(
    orpc.masterData.archive.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async () => {
        toast.success("Data diarsipkan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.masterData.list.key(),
        });
      },
    })
  );
  const reactivateRecord = useMutation(
    orpc.masterData.reactivate.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async () => {
        toast.success("Data diaktifkan kembali.");
        await queryClient.invalidateQueries({
          queryKey: orpc.masterData.list.key(),
        });
      },
    })
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCursor(undefined);
    setSubmittedSearch(search.trim());
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    const missing = fields.filter(
      (field) => !field.optional && !values[field.id]?.trim()
    );
    if (missing.length > 0) {
      return;
    }
    createRecord.mutate({ data: values, entityType });
  };

  const studyProgramOptions = (studyPrograms.data?.data ?? []).flatMap(
    (row) => {
      const code = recordText(row, "code");
      const name = recordText(row, "name");
      return code && name
        ? [{ description: name, id: recordText(row, "id"), label: code }]
        : [];
    }
  );
  const cohortSearch = referenceSearch.cohortId?.toLowerCase() ?? "";
  const cohortOptions = (cohorts.data?.data ?? []).flatMap((row) => {
    const entryYear = recordText(row, "entryYear");
    const matchesProgram =
      recordText(row, "studyProgramId") === values.studyProgramId;
    const matchesSearch = entryYear.toLowerCase().includes(cohortSearch);
    return matchesProgram && entryYear && matchesSearch
      ? [
          {
            description: "Tahun masuk",
            id: recordText(row, "id"),
            label: `Angkatan ${entryYear}`,
          },
        ]
      : [];
  });
  const academicYearOptions = (academicYears.data?.data ?? []).flatMap(
    (row) => {
      const code = recordText(row, "code");
      return code
        ? [
            {
              description: `${recordText(row, "startYear")}–${recordText(row, "endYear")}`,
              id: recordText(row, "id"),
              label: code,
            },
          ]
        : [];
    }
  );
  const referenceOptions: Record<string, readonly SuggestionOption[]> = {
    academicYearId: academicYearOptions,
    cohortId: cohortOptions,
    studyProgramId: studyProgramOptions,
  };
  const referenceLoading: Record<string, boolean> = {
    academicYearId: academicYears.isFetching,
    cohortId: cohorts.isFetching,
    studyProgramId: studyPrograms.isFetching,
  };
  const clearReference = (fieldId: string) => {
    setValues((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== fieldId)
      )
    );
    setReferenceLabels((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== fieldId)
      )
    );
  };
  const selectReference = (fieldId: string, option: SuggestionOption) => {
    setValues((current) => ({ ...current, [fieldId]: option.id }));
    setReferenceLabels((current) => ({ ...current, [fieldId]: option.label }));
    setReferenceSearch((current) => ({ ...current, [fieldId]: "" }));
    if (fieldId === "studyProgramId" && entityType === "STUDENT") {
      clearReference("cohortId");
      setReferenceSearch((current) => ({ ...current, cohortId: "" }));
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Data master
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <MasterDataCreateForm
        createPending={createRecord.isPending}
        entityLabel={labels[entityType]}
        fields={fields}
        hasSubmitted={hasSubmitted}
        onClearReference={clearReference}
        onSearchReference={(fieldId, value) => {
          setReferenceSearch((current) => ({ ...current, [fieldId]: value }));
          setReferenceLabels((current) => ({ ...current, [fieldId]: value }));
        }}
        onSelectReference={selectReference}
        onSubmit={submitCreate}
        onValueChange={(fieldId, value) =>
          setValues((current) => ({ ...current, [fieldId]: value }))
        }
        referenceLabels={referenceLabels}
        referenceLoading={referenceLoading}
        referenceOptions={referenceOptions}
        values={values}
      />
      <MasterDataListCard
        entityLabel={labels[entityType]}
        entityType={entityType}
        fields={fields}
        isError={records.isError}
        isPending={records.isPending}
        nextCursor={records.data?.nextCursor}
        onArchive={(input) => archiveRecord.mutate(input)}
        onNextPage={() => setCursor(records.data?.nextCursor ?? undefined)}
        onReactivate={(input) => reactivateRecord.mutate(input)}
        onSearchChange={setSearch}
        onStatusChange={(value) => {
          setCursor(undefined);
          setStatus(value);
        }}
        onSubmitSearch={submitSearch}
        rows={records.data?.data ?? []}
        search={search}
        status={status}
      />
    </div>
  );
};

export default MasterDataPage;

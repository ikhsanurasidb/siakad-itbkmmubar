import { studyProgramDegreeOptions } from "@siakad-itbkmmubar/api/master-data";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { DataTable } from "@siakad-itbkmmubar/ui/components/data-table";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export type MasterDataEntityType =
  | "ACADEMIC_PERIOD"
  | "ACADEMIC_YEAR"
  | "COHORT"
  | "COURSE"
  | "LECTURER"
  | "ROOM"
  | "STUDENT"
  | "STUDY_PROGRAM";

interface FieldDefinition {
  id: string;
  label: string;
  optional?: boolean;
  options?: readonly string[];
  type?: "date" | "number" | "select" | "text";
}

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
    { id: "defaultSemester", label: "Semester default", type: "number" },
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

const referenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

const recordText = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Perubahan belum dapat disimpan.";

interface SuggestionOption {
  description?: string;
  id: string;
  label: string;
}

interface ReferenceSearchFieldProps {
  error?: string;
  id: string;
  label: string;
  loading?: boolean;
  onClear: () => void;
  onSearch: (value: string) => void;
  onSelect: (option: SuggestionOption) => void;
  options: readonly SuggestionOption[];
  value: string;
}

const ReferenceSearchField = ({
  error,
  id,
  label,
  loading,
  onClear,
  onSearch,
  onSelect,
  options,
  value,
}: ReferenceSearchFieldProps) => {
  const listId = `${id}-suggestions`;
  return (
    <FormField
      error={error}
      helper="Ketik untuk mencari, lalu pilih data aktif."
      id={id}
      label={label}
    >
      <div className="relative">
        <Input
          aria-busy={loading}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          id={id}
          list={listId}
          onChange={(event) => {
            const selected = options.find(
              (option) => option.label === event.target.value
            );
            if (selected) {
              onSelect(selected);
              return;
            }
            onClear();
            onSearch(event.target.value);
          }}
          value={value}
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option
              aria-label={option.description ?? option.label}
              key={option.id}
              label={option.description ?? option.label}
              value={option.label}
            />
          ))}
        </datalist>
      </div>
    </FormField>
  );
};

type DisplayRow = Record<string, unknown> & {
  id: string;
  status?: string;
};

const MasterDataRowActions = ({
  entityType,
  onArchive,
  onReactivate,
  row,
}: {
  entityType: MasterDataEntityType;
  onArchive: (input: { entityType: MasterDataEntityType; id: string }) => void;
  onReactivate: (input: {
    entityType: MasterDataEntityType;
    id: string;
  }) => void;
  row: DisplayRow;
}) => {
  const isArchived = row.status === "ARCHIVED";
  return (
    <Button
      onClick={() => {
        if (isArchived) {
          onReactivate({ entityType, id: row.id });
        } else {
          onArchive({ entityType, id: row.id });
        }
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {isArchived ? "Aktifkan" : "Arsipkan"}
    </Button>
  );
};

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
      onError: (error) => toast.error(getErrorMessage(error)),
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
      onError: (error) => toast.error(getErrorMessage(error)),
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
      onError: (error) => toast.error(getErrorMessage(error)),
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

  const rows: DisplayRow[] = (records.data?.data ?? []).map((row) => ({
    ...row,
    action: row.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    id: String(row.id),
  }));
  const renderRowActions = (row: DisplayRow): ReactNode => (
    <MasterDataRowActions
      entityType={entityType}
      onArchive={(input) => archiveRecord.mutate(input)}
      onReactivate={(input) => reactivateRecord.mutate(input)}
      row={row}
    />
  );
  const columns = [
    ...fields.slice(0, 4).map((field) => ({
      header: field.label,
      id: field.id,
    })),
    { header: "Status", id: "status" },
    {
      cell: renderRowActions,
      header: "Aksi",
      id: "action",
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Master data
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tambah {labels[entityType]}</CardTitle>
          <CardDescription>
            Validasi dilakukan setelah formulir dikirim.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCreate}>
            {fields.map((field) => {
              const error =
                hasSubmitted && !field.optional && !values[field.id]?.trim()
                  ? `${field.label} wajib diisi.`
                  : undefined;
              if (referenceFieldIds.has(field.id)) {
                return (
                  <ReferenceSearchField
                    error={error}
                    id={`create-${field.id}`}
                    key={field.id}
                    label={field.label}
                    loading={referenceLoading[field.id]}
                    onClear={() => clearReference(field.id)}
                    onSearch={(value) => {
                      setReferenceSearch((current) => ({
                        ...current,
                        [field.id]: value,
                      }));
                      setReferenceLabels((current) => ({
                        ...current,
                        [field.id]: value,
                      }));
                    }}
                    onSelect={(option) => selectReference(field.id, option)}
                    options={referenceOptions[field.id] ?? []}
                    value={referenceLabels[field.id] ?? ""}
                  />
                );
              }
              if (field.type === "select") {
                return (
                  <FormField
                    error={error}
                    id={`create-${field.id}`}
                    key={field.id}
                    label={field.label}
                    optional={field.optional}
                  >
                    <select
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      id={`create-${field.id}`}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))
                      }
                      value={values[field.id] ?? ""}
                    >
                      <option value="">
                        Pilih {field.label.toLowerCase()}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FormField>
                );
              }
              return (
                <FormField
                  error={error}
                  id={`create-${field.id}`}
                  key={field.id}
                  label={field.label}
                  optional={field.optional}
                >
                  <Input
                    id={`create-${field.id}`}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                    type={field.type ?? "text"}
                    value={values[field.id] ?? ""}
                  />
                </FormField>
              );
            })}
            <div className="flex items-end">
              <Button disabled={createRecord.isPending} type="submit">
                {createRecord.isPending ? "Menyimpan..." : "Simpan data"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Daftar {labels[entityType]}</CardTitle>
          <CardDescription>
            Gunakan pencarian dan status untuk memuat data dari server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={submitSearch}
          >
            <FormField id="master-search" label="Cari">
              <Input
                id="master-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kode, identifier, atau nama"
                value={search}
              />
            </FormField>
            <FormField id="master-status" label="Status">
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                id="master-status"
                onChange={(event) => {
                  setCursor(undefined);
                  setStatus(
                    event.target.value
                      ? (event.target.value as "ACTIVE" | "ARCHIVED")
                      : undefined
                  );
                }}
                value={status ?? ""}
              >
                <option value="">Semua status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="ARCHIVED">Diarsipkan</option>
              </select>
            </FormField>
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" />
              Terapkan
            </Button>
          </form>
          {(() => {
            let content: ReactNode = (
              <DataTable
                columns={columns}
                getRowKey={(row) => row.id}
                rows={rows}
              />
            );
            if (records.isPending) {
              content = (
                <p className="text-muted-foreground text-sm">Memuat data...</p>
              );
            } else if (records.isError) {
              content = (
                <p className="text-destructive text-sm" role="alert">
                  Data belum dapat dimuat. Coba lagi.
                </p>
              );
            }
            return content;
          })()}
          {records.data?.nextCursor ? (
            <div>
              <Button
                onClick={() => setCursor(records.data?.nextCursor ?? undefined)}
                type="button"
                variant="outline"
              >
                Muat halaman berikutnya
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterDataPage;

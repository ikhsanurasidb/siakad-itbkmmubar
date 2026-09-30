import { academicPeriodStatusLabels } from "@siakad-itbkmmubar/api/master-data";
import type { MasterDataListStatus } from "@siakad-itbkmmubar/api/master-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import CredentialDialog from "@/components/credential-dialog";
import MasterDataCreateForm from "@/components/master-data-create-form";
import type { SuggestionOption } from "@/components/master-data-create-form";
import {
  masterDataEntityLabels,
  masterDataFieldDefinitions,
} from "@/components/master-data-definitions";
import MasterDataListCard from "@/components/master-data-list-card";
import type { MasterDataEntityType } from "@/components/master-data-types";
import { orpc } from "@/utils/orpc";

const noop = (): undefined => undefined;

interface MasterDataPageProps {
  description: string;
  entityType: MasterDataEntityType;
  showAcademicYearCreate?: boolean;
  title: string;
}

const recordText = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const getErrorMessage = (): string =>
  "Perubahan belum dapat disimpan. Periksa data lalu coba lagi.";

const getMasterDataRootPath = (): string => {
  if (typeof window === "undefined") {
    return "/admin-akademik/master-data";
  }
  const [rolePath] = window.location.pathname.split("/master-data/");
  return `${rolePath || "/admin-akademik"}/master-data`;
};

interface CreatedCredential {
  accountLabel: string;
  identifier: string;
  password: string;
}

const MasterDataPage = ({
  description,
  entityType,
  showAcademicYearCreate = false,
  title,
}: MasterDataPageProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState<MasterDataListStatus | undefined>();
  const [cursor, setCursor] = useState<string>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [referenceLabels, setReferenceLabels] = useState<
    Record<string, string>
  >({});
  const [referenceSearch, setReferenceSearch] = useState<
    Record<string, string>
  >({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [academicYearValues, setAcademicYearValues] = useState<
    Record<string, string>
  >({});
  const [academicYearHasSubmitted, setAcademicYearHasSubmitted] =
    useState(false);
  const [createdCredential, setCreatedCredential] =
    useState<CreatedCredential | null>(null);
  const fields = masterDataFieldDefinitions[entityType];
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
      onSuccess: async (result) => {
        if (result.credential) {
          setCreatedCredential({
            accountLabel: recordText(result, "name"),
            identifier: result.credential.identifier,
            password: result.credential.temporaryPassword,
          });
        }
        setValues({});
        setReferenceLabels({});
        setReferenceSearch({});
        setHasSubmitted(false);
        toast.success(
          `${masterDataEntityLabels[entityType]} berhasil ditambahkan.`
        );
        await queryClient.invalidateQueries({
          queryKey: orpc.masterData.list.key(),
        });
      },
    })
  );
  const createAcademicYearRecord = useMutation(
    orpc.masterData.create.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async () => {
        setAcademicYearValues({});
        setAcademicYearHasSubmitted(false);
        toast.success("Tahun akademik berhasil ditambahkan.");
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
  const changeAcademicPeriodStatus = useMutation(
    orpc.masterData.changeAcademicPeriodStatus.mutationOptions({
      onError: () => toast.error(getErrorMessage()),
      onSuccess: async (_result, variables) => {
        toast.success(
          `Status periode diubah menjadi ${academicPeriodStatusLabels[variables.status]}.`
        );
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
    setCreatedCredential(null);
    createRecord.mutate({ data: values, entityType });
  };

  const submitAcademicYearCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAcademicYearHasSubmitted(true);
    const academicYearFields = masterDataFieldDefinitions.ACADEMIC_YEAR;
    const missing = academicYearFields.filter(
      (field) => !field.optional && !academicYearValues[field.id]?.trim()
    );
    if (missing.length > 0) {
      return;
    }
    createAcademicYearRecord.mutate({
      data: academicYearValues,
      entityType: "ACADEMIC_YEAR",
    });
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
      {showAcademicYearCreate ? (
        <MasterDataCreateForm
          createPending={createAcademicYearRecord.isPending}
          entityLabel={masterDataEntityLabels.ACADEMIC_YEAR}
          fields={masterDataFieldDefinitions.ACADEMIC_YEAR}
          hasSubmitted={academicYearHasSubmitted}
          onClearReference={noop}
          onSearchReference={noop}
          onSelectReference={noop}
          onSubmit={submitAcademicYearCreate}
          onValueChange={(fieldId, value) =>
            setAcademicYearValues((current) => ({
              ...current,
              [fieldId]: value,
            }))
          }
          referenceLabels={{}}
          referenceLoading={{}}
          referenceOptions={{}}
          values={academicYearValues}
        />
      ) : null}
      <MasterDataCreateForm
        createPending={createRecord.isPending}
        entityLabel={masterDataEntityLabels[entityType]}
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
      {createdCredential && (
        <CredentialDialog
          accountLabel={createdCredential.accountLabel}
          description="Kata sandi sementara wajib diganti saat login pertama. Simpan atau sampaikan kredensial melalui kanal yang aman."
          identifier={createdCredential.identifier}
          onClose={() => setCreatedCredential(null)}
          open={Boolean(createdCredential)}
          password={createdCredential.password}
          title={`${masterDataEntityLabels[entityType]} berhasil dibuat`}
        />
      )}
      <MasterDataListCard
        detailRootPath={getMasterDataRootPath()}
        entityLabel={masterDataEntityLabels[entityType]}
        entityType={entityType}
        fields={fields}
        isError={records.isError}
        isPending={records.isPending}
        nextCursor={records.data?.nextCursor}
        onArchive={(input) => archiveRecord.mutate(input)}
        onAcademicPeriodStatusChange={(input) =>
          changeAcademicPeriodStatus.mutate(input)
        }
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
        academicPeriodStatusChangePending={changeAcademicPeriodStatus.isPending}
      />
    </div>
  );
};

export default MasterDataPage;

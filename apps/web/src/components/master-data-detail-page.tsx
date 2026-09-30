import { getDatePartsInTimeZone } from "@siakad-itbkmmubar/api/time-zone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import type {
  FieldDefinition,
  SuggestionOption,
} from "@/components/master-data-create-form";
import {
  getMasterDataReferenceLabel,
  masterDataEntityLabels,
  masterDataFieldDefinitions,
} from "@/components/master-data-definitions";
import { MasterDataDetailSummary } from "@/components/master-data-detail-summary";
import { MasterDataEditDialog } from "@/components/master-data-edit-dialog";
import type { MasterDataEntityType } from "@/components/master-data-types";
import { ENV } from "@/env.public";
import { orpc } from "@/utils/orpc";

interface MasterDataDetailPageProps {
  basePath: string;
  entityType: MasterDataEntityType;
  recordId: string;
}

const referenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

const recordText = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
};

const valueForInput = (
  record: Record<string, unknown>,
  fieldId: string,
  type: string | undefined
): string => {
  const value = record[fieldId];
  if (value === null || value === undefined) {
    return "";
  }
  if (type === "date") {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const { day, month, year } = getDatePartsInTimeZone(
      date,
      ENV.VITE_BUSINESS_TIME_ZONE
    );
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return String(value);
};

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return "Data belum dapat disimpan. Periksa data lalu coba lagi.";
};

const getInitialValues = (
  record: Record<string, unknown>,
  fields: readonly FieldDefinition[]
): Record<string, string> =>
  Object.fromEntries(
    fields.map((field) => [
      field.id,
      valueForInput(record, field.id, field.type),
    ])
  );

const MasterDataDetailPage = ({
  basePath,
  entityType,
  recordId,
}: MasterDataDetailPageProps) => {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [referenceLabels, setReferenceLabels] = useState<
    Record<string, string>
  >({});
  const [referenceSearch, setReferenceSearch] = useState<
    Record<string, string>
  >({});
  const recordQuery = useQuery(
    orpc.masterData.get.queryOptions({
      input: { entityType, id: recordId },
    })
  );
  const record = recordQuery.data;
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
      input: { entityType: "COHORT", limit: 100, status: "ACTIVE" },
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
  const updateRecord = useMutation(
    orpc.masterData.update.mutationOptions({
      onError: (error) => {
        if (getErrorCode(error) === "MASTER_DATA_VERSION_CONFLICT") {
          toast.error("Data berubah. Muat ulang detail sebelum mengubahnya.");
          setEditOpen(false);
          void queryClient.invalidateQueries({
            queryKey: orpc.masterData.get.key(),
          });
          return;
        }
        toast.error(getErrorMessage(error));
      },
      onSuccess: async () => {
        toast.success("Perubahan data disimpan.");
        setEditOpen(false);
        setHasSubmitted(false);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.masterData.get.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.masterData.list.key(),
          }),
        ]);
      },
    })
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (editOpen && !dialog.open) {
      dialog.showModal();
    }
    if (!editOpen && dialog.open) {
      dialog.close();
    }
  }, [editOpen]);

  const referenceOptions = useMemo<Record<string, readonly SuggestionOption[]>>(
    () => ({
      academicYearId: (academicYears.data?.data ?? []).flatMap((row) => {
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
      }),
      cohortId: (cohorts.data?.data ?? []).flatMap((row) => {
        const entryYear = recordText(row, "entryYear");
        return recordText(row, "studyProgramId") === values.studyProgramId &&
          entryYear
          ? [
              {
                description: "Tahun masuk",
                id: recordText(row, "id"),
                label: `Angkatan ${entryYear}`,
              },
            ]
          : [];
      }),
      studyProgramId: (studyPrograms.data?.data ?? []).flatMap((row) => {
        const code = recordText(row, "code");
        const name = recordText(row, "name");
        return code && name
          ? [{ description: name, id: recordText(row, "id"), label: code }]
          : [];
      }),
    }),
    [
      academicYears.data?.data,
      cohorts.data?.data,
      studyPrograms.data?.data,
      values.studyProgramId,
    ]
  );
  const referenceLoading: Record<string, boolean> = {
    academicYearId: academicYears.isFetching,
    cohortId: cohorts.isFetching,
    studyProgramId: studyPrograms.isFetching,
  };

  const resolvedReferenceLabels = useMemo(() => {
    const labels = { ...referenceLabels };
    if (record) {
      for (const fieldId of referenceFieldIds) {
        const recordLabel = getMasterDataReferenceLabel(record, fieldId);
        if (recordLabel && !labels[fieldId]) {
          labels[fieldId] = recordLabel;
          continue;
        }
        const selected = referenceOptions[fieldId]?.find(
          (option) => option.id === recordText(record, fieldId)
        );
        if (selected && !labels[fieldId]) {
          labels[fieldId] = selected.label;
        }
      }
    }
    return labels;
  }, [record, referenceLabels, referenceOptions]);

  const openEditor = () => {
    if (!record) {
      return;
    }
    setValues(getInitialValues(record, fields));
    setReferenceLabels({});
    setReferenceSearch({});
    setHasSubmitted(false);
    setEditOpen(true);
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
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    const missing = fields.filter(
      (field) => !field.optional && !values[field.id]?.trim()
    );
    const invalidEmail = ["email"].some(
      (fieldId) =>
        values[fieldId] &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values[fieldId] ?? "")
    );
    const invalidPhone = Boolean(
      values.phone && !/^\+?[0-9]{10,15}$/u.test(values.phone)
    );
    if (missing.length > 0 || invalidEmail || invalidPhone || !record) {
      return;
    }
    updateRecord.mutate({
      data: values,
      entityType,
      expectedVersion: Number(record.version ?? 1),
      id: recordId,
    });
  };

  if (recordQuery.isPending) {
    return (
      <p className="p-6 text-sm">
        Memuat detail {masterDataEntityLabels[entityType]}...
      </p>
    );
  }
  if (recordQuery.isError || !record) {
    return (
      <div className="grid gap-4 p-6">
        <p className="text-destructive text-sm" role="alert">
          Detail data belum dapat dimuat. Coba lagi.
        </p>
        <a className="text-primary text-sm underline" href={basePath}>
          Kembali ke daftar
        </a>
      </div>
    );
  }

  const entityLabel = masterDataEntityLabels[entityType];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-4 lg:p-6">
      <MasterDataDetailSummary
        basePath={basePath}
        entityLabel={entityLabel}
        fields={fields}
        onEdit={openEditor}
        record={record}
      />

      <MasterDataEditDialog
        dialogRef={dialogRef}
        entityLabel={entityLabel}
        fields={fields}
        hasSubmitted={hasSubmitted}
        onCancel={() => setEditOpen(false)}
        onClearReference={clearReference}
        onSearchReference={(fieldId, value) => {
          setReferenceSearch((current) => ({
            ...current,
            [fieldId]: value,
          }));
          setReferenceLabels((current) => ({
            ...current,
            [fieldId]: value,
          }));
        }}
        onSelectReference={selectReference}
        onSubmit={submit}
        onValueChange={(fieldId, value) =>
          setValues((current) => ({
            ...current,
            [fieldId]: value,
          }))
        }
        referenceLabels={referenceLabels}
        referenceLoading={referenceLoading}
        referenceOptions={referenceOptions}
        resolvedReferenceLabels={resolvedReferenceLabels}
        updatePending={updateRecord.isPending}
        values={values}
      />
    </div>
  );
};

export default MasterDataDetailPage;

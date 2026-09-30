import {
  academicPeriodStatusLabels,
  academicPeriodStatusTransitions,
  formatAcademicPeriodTerm,
  isAcademicPeriodStatus,
} from "@siakad-itbkmmubar/api/master-data";
import type {
  AcademicPeriodStatus,
  MasterDataListStatus,
} from "@siakad-itbkmmubar/api/master-data";
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
import { Search } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import type { FieldDefinition } from "@/components/master-data-create-form";
import {
  getMasterDataReferenceLabel,
  isMasterDataReferenceField,
} from "@/components/master-data-definitions";
import { masterDataEntitySlugs } from "@/components/master-data-types";
import type { MasterDataEntityType } from "@/components/master-data-types";
import { ENV } from "@/env.public";

type DisplayRow = Record<string, unknown> & {
  id: string;
  status?: string;
  statusCode?: string;
  version: number;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: ENV.VITE_BUSINESS_TIME_ZONE,
});

const statusLabels: Record<string, string> = {
  ...academicPeriodStatusLabels,
  ARCHIVED: "Diarsipkan",
};

const formatFieldValue = (
  fieldId: string,
  value: unknown,
  record: DisplayRow
): string => {
  const referenceLabel = getMasterDataReferenceLabel(record, fieldId);
  if (referenceLabel) {
    return referenceLabel;
  }
  if (isMasterDataReferenceField(fieldId)) {
    return "—";
  }
  if (fieldId === "term" && typeof value === "string") {
    return formatAcademicPeriodTerm(value);
  }
  if (value instanceof Date) {
    return dateFormatter.format(value);
  }
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return dateFormatter.format(date);
    }
  }
  return String(value ?? "—");
};

interface MasterDataListCardProps {
  detailRootPath: string;
  entityLabel: string;
  entityType: MasterDataEntityType;
  fields: readonly FieldDefinition[];
  isError: boolean;
  isPending: boolean;
  nextCursor: string | null | undefined;
  onArchive: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  onAcademicPeriodStatusChange?: (input: {
    expectedVersion: number;
    id: string;
    status: AcademicPeriodStatus;
  }) => void;
  onNextPage: () => void;
  onReactivate: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: MasterDataListStatus | undefined) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  rows: readonly Record<string, unknown>[];
  search: string;
  status: MasterDataListStatus | undefined;
  academicPeriodStatusChangePending?: boolean;
}

const MasterDataRowActions = ({
  detailRootPath,
  entityType,
  onArchive,
  onAcademicPeriodStatusChange,
  onReactivate,
  row,
  statusChangePending,
}: {
  detailRootPath: string;
  entityType: MasterDataEntityType;
  onArchive: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  onAcademicPeriodStatusChange?: (input: {
    expectedVersion: number;
    id: string;
    status: AcademicPeriodStatus;
  }) => void;
  onReactivate: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  row: DisplayRow;
  statusChangePending?: boolean;
}) => {
  const isArchived = row.statusCode === "ARCHIVED";
  const currentStatus = row.statusCode ?? "";
  const academicPeriodStatuses =
    entityType === "ACADEMIC_PERIOD" && isAcademicPeriodStatus(currentStatus)
      ? academicPeriodStatusTransitions[currentStatus]
      : [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        href={`${detailRootPath}/${masterDataEntitySlugs[entityType]}/${row.id}`}
      >
        Lihat detail
      </a>
      <Button
        onClick={() => {
          if (isArchived) {
            onReactivate({
              entityType,
              expectedVersion: row.version,
              id: row.id,
            });
          } else {
            onArchive({
              entityType,
              expectedVersion: row.version,
              id: row.id,
            });
          }
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {isArchived ? "Aktifkan" : "Arsipkan"}
      </Button>
      {academicPeriodStatuses.length > 0 && onAcademicPeriodStatusChange ? (
        <select
          aria-label="Ubah status periode akademik"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          defaultValue=""
          disabled={statusChangePending}
          onChange={(event) => {
            const nextStatus = event.target.value;
            if (isAcademicPeriodStatus(nextStatus)) {
              onAcademicPeriodStatusChange({
                expectedVersion: row.version,
                id: row.id,
                status: nextStatus,
              });
            }
          }}
        >
          <option value="">Ubah status</option>
          {academicPeriodStatuses.map((status) => (
            <option key={status} value={status}>
              {academicPeriodStatusLabels[status]}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
};

const MasterDataListCard = ({
  detailRootPath,
  entityLabel,
  entityType,
  fields,
  isError,
  isPending,
  nextCursor,
  onArchive,
  onAcademicPeriodStatusChange,
  onNextPage,
  onReactivate,
  onSearchChange,
  onStatusChange,
  onSubmitSearch,
  rows: sourceRows,
  search,
  status,
  academicPeriodStatusChangePending = false,
}: MasterDataListCardProps) => {
  const rows: DisplayRow[] = sourceRows.map((row) => ({
    ...row,
    id: String(row.id),
    status: statusLabels[String(row.status)] ?? "—",
    statusCode: String(row.status ?? ""),
    version: Number(row.version ?? 1),
  }));
  const renderRowActions = (row: DisplayRow): ReactNode => (
    <MasterDataRowActions
      detailRootPath={detailRootPath}
      entityType={entityType}
      onArchive={onArchive}
      onAcademicPeriodStatusChange={onAcademicPeriodStatusChange}
      onReactivate={onReactivate}
      row={row}
      statusChangePending={academicPeriodStatusChangePending}
    />
  );
  const columns = [
    ...fields.slice(0, 4).map((field) => ({
      cell: (row: DisplayRow) => formatFieldValue(field.id, row[field.id], row),
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
  let content: ReactNode = (
    <DataTable columns={columns} getRowKey={(row) => row.id} rows={rows} />
  );
  if (isPending) {
    content = <p className="text-muted-foreground text-sm">Memuat data...</p>;
  } else if (isError) {
    content = (
      <p className="text-destructive text-sm" role="alert">
        Data belum dapat dimuat. Coba lagi.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar {entityLabel}</CardTitle>
        <CardDescription>
          Gunakan pencarian dan status untuk memuat data dari server.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={onSubmitSearch}
        >
          <FormField id="master-search" label="Cari">
            <Input
              id="master-search"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Kode, identifier, atau nama"
              value={search}
            />
          </FormField>
          <FormField id="master-status" label="Status">
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              id="master-status"
              onChange={(event) => {
                const { value } = event.target;
                onStatusChange(
                  value === "ACTIVE" ||
                    value === "ARCHIVED" ||
                    value === "DRAFT" ||
                    value === "CLOSED"
                    ? value
                    : undefined
                );
              }}
              value={status ?? ""}
            >
              <option value="">Semua status</option>
              {entityType === "ACADEMIC_PERIOD" ? (
                <>
                  <option value="DRAFT">Draf</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="CLOSED">Ditutup</option>
                  <option value="ARCHIVED">Diarsipkan</option>
                </>
              ) : (
                <>
                  <option value="ACTIVE">Aktif</option>
                  <option value="ARCHIVED">Diarsipkan</option>
                </>
              )}
            </select>
          </FormField>
          <Button type="submit" variant="outline">
            <Search aria-hidden="true" />
            Terapkan
          </Button>
        </form>
        {content}
        {nextCursor ? (
          <div>
            <Button onClick={onNextPage} type="button" variant="outline">
              Muat halaman berikutnya
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default MasterDataListCard;

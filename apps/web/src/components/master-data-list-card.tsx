import { formatAcademicPeriodTerm } from "@siakad-itbkmmubar/api/master-data";
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

type DisplayRow = Record<string, unknown> & {
  id: string;
  status?: string;
  statusCode?: string;
  version: number;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  ARCHIVED: "Diarsipkan",
  CLOSED: "Ditutup",
  DRAFT: "Draf",
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
  onNextPage: () => void;
  onReactivate: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "ACTIVE" | "ARCHIVED" | undefined) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  rows: readonly Record<string, unknown>[];
  search: string;
  status: "ACTIVE" | "ARCHIVED" | undefined;
}

const MasterDataRowActions = ({
  detailRootPath,
  entityType,
  onArchive,
  onReactivate,
  row,
}: {
  detailRootPath: string;
  entityType: MasterDataEntityType;
  onArchive: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  onReactivate: (input: {
    entityType: MasterDataEntityType;
    expectedVersion: number;
    id: string;
  }) => void;
  row: DisplayRow;
}) => {
  const isArchived = row.statusCode === "ARCHIVED";
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
  onNextPage,
  onReactivate,
  onSearchChange,
  onStatusChange,
  onSubmitSearch,
  rows: sourceRows,
  search,
  status,
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
      onReactivate={onReactivate}
      row={row}
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
                  value === "ACTIVE" || value === "ARCHIVED" ? value : undefined
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

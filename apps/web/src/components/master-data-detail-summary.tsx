import {
  formatAcademicPeriodTerm,
  studentAcademicStatusLabels,
} from "@siakad-itbkmmubar/api/master-data";
import { getDatePartsInTimeZone } from "@siakad-itbkmmubar/api/time-zone";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { ArrowLeft, Pencil } from "lucide-react";

import type { FieldDefinition } from "@/components/master-data-create-form";
import {
  getMasterDataReferenceLabel,
  isMasterDataReferenceField,
} from "@/components/master-data-definitions";
import { ENV } from "@/env.public";

const formatDate = (value: Date): string => {
  const { day, month, year } = getDatePartsInTimeZone(
    value,
    ENV.VITE_BUSINESS_TIME_ZONE
  );
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};

const formatDetailValue = (
  value: unknown,
  fieldId: string | undefined,
  record: Record<string, unknown>
): string => {
  if (fieldId) {
    const referenceLabel = getMasterDataReferenceLabel(record, fieldId);
    if (referenceLabel) {
      return referenceLabel;
    }
    if (isMasterDataReferenceField(fieldId)) {
      return "—";
    }
  }
  if (fieldId === "term" && typeof value === "string") {
    return formatAcademicPeriodTerm(value);
  }
  if (
    fieldId === "academicStatus" &&
    typeof value === "string" &&
    value in studentAcademicStatusLabels
  ) {
    return studentAcademicStatusLabels[
      value as keyof typeof studentAcademicStatusLabels
    ];
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatDate(date);
    }
  }
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
};

interface MasterDataDetailSummaryProps {
  basePath: string;
  entityLabel: string;
  fields: readonly FieldDefinition[];
  onEdit: () => void;
  record: Record<string, unknown>;
}

export const MasterDataDetailSummary = ({
  basePath,
  entityLabel,
  fields,
  onEdit,
  record,
}: MasterDataDetailSummaryProps) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid gap-2">
        <a
          className="text-primary inline-flex items-center gap-2 text-sm"
          href={basePath}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Kembali ke daftar {entityLabel.toLowerCase()}
        </a>
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Data master
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Detail {entityLabel}
        </h1>
        <p className="text-muted-foreground text-sm">
          Tinjau data dan ubah informasi master dengan aman.
        </p>
      </div>
      <Button onClick={onEdit} type="button">
        <Pencil aria-hidden="true" />
        Ubah data
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Informasi {entityLabel}</CardTitle>
        <CardDescription>
          Versi data:{" "}
          {formatDetailValue(record.version ?? 1, undefined, record)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div className="grid gap-1" key={field.id}>
              <dt className="text-muted-foreground text-xs">{field.label}</dt>
              <dd className="text-sm">
                {formatDetailValue(record[field.id], field.id, record)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  </>
);

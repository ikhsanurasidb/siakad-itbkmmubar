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

const formatDetailValue = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toLocaleDateString("id-ID");
  }
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("id-ID");
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
          Versi data: {formatDetailValue(record.version ?? 1)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div className="grid gap-1" key={field.id}>
              <dt className="text-muted-foreground text-xs">{field.label}</dt>
              <dd className="text-sm">{formatDetailValue(record[field.id])}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  </>
);

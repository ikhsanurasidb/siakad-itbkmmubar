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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import type { MasterDataEntityType } from "@/components/master-data-types";
import {
  calculateMasterDataImportChecksum,
  downloadMasterDataTemplate,
  MASTER_DATA_IMPORT_MIME_TYPE,
  parseMasterDataWorkbook,
} from "@/lib/master-data-import-xlsx";
import { orpc } from "@/utils/orpc";

const entityOptions = [
  ["STUDY_PROGRAM", "Prodi"],
  ["COHORT", "Angkatan"],
  ["STUDENT", "Mahasiswa"],
  ["LECTURER", "Dosen"],
  ["ROOM", "Ruang"],
  ["COURSE", "Mata kuliah"],
  ["ACADEMIC_YEAR", "Tahun akademik"],
  ["ACADEMIC_PERIOD", "Periode"],
] as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Impor belum dapat diproses. Periksa file lalu coba lagi.";

const importRowStatusLabels: Record<string, string> = {
  INVALID: "Perlu diperbaiki",
  VALID: "Lolos validasi",
  WARNING: "Peringatan",
};

interface MasterDataImportPageProps {
  description: string;
  title: string;
}

const MasterDataImportPage = ({
  description,
  title,
}: MasterDataImportPageProps) => {
  const [entityType, setEntityType] =
    useState<(typeof entityOptions)[number][0]>("STUDENT");
  const [jobId, setJobId] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const preview = useQuery(
    orpc.masterData.import.preview.queryOptions({
      enabled: Boolean(jobId),
      input: { jobId: jobId ?? "", limit: 100 },
    })
  );
  const createImport = useMutation(
    orpc.masterData.import.create.mutationOptions({
      onError: (error) => {
        setJobId(undefined);
        setFileName("");
        setRowCount(0);
        setFileInputKey((key) => key + 1);
        toast.error(getErrorMessage(error));
      },
      onSuccess: (result) => {
        setJobId(result.id);
        toast.success("File tervalidasi. Periksa pratinjau sebelum menyimpan.");
      },
    })
  );
  const commitImport = useMutation(
    orpc.masterData.import.commit.mutationOptions({
      onError: (error) => toast.error(getErrorMessage(error)),
      onSuccess: () => {
        toast.success("Pemrosesan impor dilanjutkan.");
        void preview.refetch();
      },
    })
  );

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setJobId(undefined);
    try {
      const parsed = await parseMasterDataWorkbook(file, entityType);
      setFileName(file.name);
      setRowCount(parsed.rowCount);
      createImport.mutate({
        checksum: await calculateMasterDataImportChecksum(
          entityType,
          parsed.rows
        ),
        entityType,
        filename: file.name,
        rows: parsed.rows,
        templateVersion: "1",
      });
    } catch (error) {
      setFileName("");
      setRowCount(0);
      setFileInputKey((key) => key + 1);
      toast.error(getErrorMessage(error));
    }
  };

  const handleEntityChange = (nextEntityType: MasterDataEntityType) => {
    setEntityType(nextEntityType);
    setJobId(undefined);
    setFileName("");
    setRowCount(0);
    setFileInputKey((key) => key + 1);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadMasterDataTemplate(entityType);
      toast.success("Template XLSX berhasil diunduh.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const rows = (preview.data?.data ?? []).map((row) => ({
    errors: typeof row.errors === "string" ? row.errors : "—",
    id: String(row.id),
    rowNumber: String(row.rowNumber),
    status: importRowStatusLabels[String(row.status)] ?? String(row.status),
  }));

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Data master
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Unggah dan validasi</CardTitle>
          <CardDescription>
            Isi worksheet Data pada template XLSX versi 1. Worksheet Petunjuk
            berisi contoh dan aturan, tetapi tidak ikut diparsing atau dikirim.
            Server hanya menerima kolom data yang dibutuhkan. DSN diterbitkan
            server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField id="import-entity" label="Jenis data">
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              id="import-entity"
              onChange={(event) =>
                handleEntityChange(event.target.value as MasterDataEntityType)
              }
              value={entityType}
            >
              {entityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              className="mt-2"
              onClick={handleDownloadTemplate}
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" />
              Unduh template XLSX
            </Button>
          </FormField>
          <FormField
            helper={
              fileName
                ? `File dipilih: ${fileName} (${rowCount.toLocaleString("id-ID")} baris)`
                : "Format .xlsx, ukuran maksimal 10 MB."
            }
            id="import-file"
            label="File XLSX"
          >
            <Input
              accept={`.xlsx,${MASTER_DATA_IMPORT_MIME_TYPE}`}
              disabled={createImport.isPending}
              id="import-file"
              key={fileInputKey}
              onChange={handleFile}
              type="file"
            />
          </FormField>
        </CardContent>
      </Card>
      {jobId && preview.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Pratinjau hasil validasi</CardTitle>
            <CardDescription>
              Lolos: {String(preview.data.job.validCount ?? 0)} · Peringatan:{" "}
              {String(preview.data.job.warningCount ?? 0)} · Perlu diperbaiki:{" "}
              {String(preview.data.job.invalidCount ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DataTable
              columns={[
                { header: "Baris", id: "rowNumber" },
                { header: "Status", id: "status" },
                { header: "Keterangan", id: "errors" },
              ]}
              getRowKey={(row) => row.id}
              rows={rows}
            />
            <div>
              <Button
                disabled={commitImport.isPending}
                onClick={() => commitImport.mutate({ jobId, limit: 25 })}
                type="button"
              >
                {commitImport.isPending
                  ? "Menyimpan..."
                  : "Simpan data tervalidasi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default MasterDataImportPage;

import type { SettingCategory } from "@siakad-itbkmmubar/api/settings";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { PageHeader } from "@siakad-itbkmmubar/ui/components/page-header";
import { State } from "@siakad-itbkmmubar/ui/components/state";
import { Textarea } from "@siakad-itbkmmubar/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface SettingsPageProps {
  category: SettingCategory;
  description: string;
  title: string;
}

interface SettingItem {
  defaultValue: unknown;
  description: string;
  key: string;
  label: string;
  maxValue: number | null;
  minValue: number | null;
  value: unknown;
  valueType: string;
  version: number;
}

const gradeFieldLabels = {
  maxScore: "Nilai maksimum",
  minScore: "Nilai minimum",
  qualityPoints: "Bobot mutu",
} as const;

const datetimeLocalValue = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const valueAsText = (item: SettingItem): string => {
  if (Array.isArray(item.value)) {
    return item.value.join("\n");
  }
  return item.value === null || item.value === undefined
    ? ""
    : String(item.value);
};

const valueForSubmit = (item: SettingItem, value: string): unknown => {
  if (item.key === "allowed_mime_types") {
    return value
      .split(/[\n,]/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (item.valueType === "INTEGER" || item.valueType === "DECIMAL") {
    return Number(value);
  }
  return value;
};

interface SettingInputProps {
  item: SettingItem;
  onChange: (value: string) => void;
  value: string;
}

const SettingInput = ({ item, onChange, value }: SettingInputProps) => {
  const id = `setting-${item.key}`;
  const selectClassName =
    "border-input bg-background h-11 rounded-xl border px-3 text-sm";

  if (item.key === "allowed_mime_types") {
    return (
      <Textarea
        id={id}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        value={value}
      />
    );
  }
  if (item.key === "retake_policy") {
    return (
      <select
        aria-label={item.label}
        className={selectClassName}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="HIGHEST">Nilai tertinggi</option>
        <option value="LATEST">Nilai terbaru</option>
      </select>
    );
  }
  if (item.key === "rounding_method") {
    return (
      <select
        aria-label={item.label}
        className={selectClassName}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="HALF_UP">Setengah ke atas</option>
        <option value="HALF_EVEN">Setengah ke genap</option>
        <option value="TRUNCATE">Potong desimal</option>
      </select>
    );
  }
  return (
    <Input
      id={id}
      max={item.maxValue ?? undefined}
      min={item.minValue ?? undefined}
      onChange={(event) => onChange(event.target.value)}
      step={item.valueType === "DECIMAL" ? "any" : 1}
      type={
        item.valueType === "INTEGER" || item.valueType === "DECIMAL"
          ? "number"
          : "text"
      }
      value={value}
    />
  );
};

const SettingsPage = ({ category, description, title }: SettingsPageProps) => {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    datetimeLocalValue(new Date())
  );
  const [note, setNote] = useState("");
  const catalog = useQuery(
    orpc.settings.catalog.queryOptions({
      input: { category, scopeId: "", scopeType: "SYSTEM" },
    })
  );
  const gradeScales = useQuery(
    orpc.settings.gradeScales.list.queryOptions({
      enabled: category === "GRADING",
      input: { scopeId: "", scopeType: "SYSTEM" },
    })
  );
  const [gradeEntries, setGradeEntries] = useState<
    {
      gradeCode: string;
      label: string;
      maxScore: number;
      minScore: number;
      qualityPoints: number;
    }[]
  >([]);

  const publish = useMutation(
    orpc.settings.publish.mutationOptions({
      onError: () => toast.error("Pengaturan belum dapat dipublikasikan."),
      onSuccess: async () => {
        toast.success("Versi pengaturan baru dipublikasikan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.catalog.key(),
        });
      },
    })
  );
  const publishGradeScale = useMutation(
    orpc.settings.gradeScales.publish.mutationOptions({
      onError: () => toast.error("Skala nilai belum dapat dipublikasikan."),
      onSuccess: async () => {
        toast.success("Skala nilai baru dipublikasikan.");
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.gradeScales.list.key(),
        });
      },
    })
  );

  if (catalog.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description={description}
          eyebrow="Pengaturan"
          title={title}
        />
        <State
          description="Kebijakan yang berlaku sedang dimuat."
          title="Memuat pengaturan"
          variant="loading"
        />
      </div>
    );
  }

  if (catalog.isError || !catalog.data) {
    return (
      <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
        <PageHeader
          description={description}
          eyebrow="Pengaturan"
          title={title}
        />
        <State
          action={
            <Button onClick={() => catalog.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          }
          description="Pengaturan belum dapat dimuat. Coba lagi atau periksa koneksi."
          title="Pengaturan tidak tersedia"
          variant="error"
        />
      </div>
    );
  }

  const items = catalog.data.items as readonly SettingItem[];
  const currentGradeEntries =
    gradeEntries.length > 0
      ? gradeEntries
      : (gradeScales.data?.[0]?.entries ?? []);
  const updateGradeEntry = (
    index: number,
    field: "gradeCode" | "label" | "maxScore" | "minScore" | "qualityPoints",
    value: number | string
  ) => {
    setGradeEntries((current) => {
      const source = current.length > 0 ? current : currentGradeEntries;
      return source.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );
    });
  };
  const submit = () => {
    const parsedEffectiveFrom = new Date(effectiveFrom);
    if (Number.isNaN(parsedEffectiveFrom.getTime())) {
      toast.error("Tanggal mulai berlaku tidak valid.");
      return;
    }
    publish.mutate({
      effectiveFrom: parsedEffectiveFrom,
      expectedVersions: Object.fromEntries(
        items.map((item) => [item.key, item.version])
      ),
      note: note.trim() || undefined,
      scope: { scopeId: "", scopeType: "SYSTEM" },
      values: Object.fromEntries(
        items.map((item) => [
          item.key,
          valueForSubmit(item, values[item.key] ?? valueAsText(item)),
        ])
      ),
    });
  };

  const saveGradeScale = () => {
    publishGradeScale.mutate({
      effectiveFrom: new Date(effectiveFrom),
      entries: currentGradeEntries.map((entry) => ({ ...entry })),
      name: `Skala nilai ${new Date().toLocaleDateString("id-ID")}`,
      scope: { scopeId: "", scopeType: "SYSTEM" },
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
      <PageHeader
        description={description}
        eyebrow="Pengaturan sistem dan kebijakan akademik"
        title={title}
      />
      <section className="flex items-start gap-3 rounded-2xl border border-[#cfe1ef] bg-[#f4f9fd] p-4 text-sm text-[#214e70]">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>
          Setiap perubahan membuat versi baru. Transaksi historis tetap merujuk
          ke versi kebijakan yang dipakai saat transaksi dibuat.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Versi kebijakan berikutnya</CardTitle>
          <CardDescription>
            Nilai saat ini berlaku sampai versi baru mencapai tanggal efektif.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FormField
              helper="Gunakan waktu lokal perangkat Anda."
              id="settings-effective-from"
              label="Mulai berlaku"
            >
              <Input
                id="settings-effective-from"
                onChange={(event) => setEffectiveFrom(event.target.value)}
                type="datetime-local"
                value={effectiveFrom}
              />
            </FormField>
            <FormField
              helper="Catatan ini masuk ke riwayat aktivasi."
              id="settings-note"
              label="Catatan perubahan"
              optional
            >
              <Input
                id="settings-note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Contoh: Penyesuaian kebijakan semester baru"
                value={note}
              />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <FormField
                helper={`${item.description} Versi ${item.version}.`}
                id={`setting-${item.key}`}
                key={item.key}
                label={item.label}
              >
                <SettingInput
                  item={item}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [item.key]: value }))
                  }
                  value={values[item.key] ?? valueAsText(item)}
                />
              </FormField>
            ))}
          </div>
          <div className="flex justify-end">
            <Button disabled={publish.isPending} onClick={submit}>
              <Save aria-hidden="true" />
              Publikasikan versi
            </Button>
          </div>
        </CardContent>
      </Card>
      {category === "GRADING" ? (
        <Card>
          <CardHeader>
            <CardTitle>Skala nilai</CardTitle>
            <CardDescription>
              Rentang wajib mencakup 0–100 tanpa tumpang tindih atau celah.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3">
              {currentGradeEntries.map((entry, index) => (
                <div
                  className="grid gap-2 sm:grid-cols-[5rem_1fr_6rem_6rem_6rem]"
                  key={entry.gradeCode}
                >
                  <Input
                    aria-label={`Kode nilai ${index + 1}`}
                    onChange={(event) =>
                      updateGradeEntry(index, "gradeCode", event.target.value)
                    }
                    value={entry.gradeCode}
                  />
                  <Input
                    aria-label={`Label nilai ${index + 1}`}
                    onChange={(event) =>
                      updateGradeEntry(index, "label", event.target.value)
                    }
                    value={entry.label}
                  />
                  {(["minScore", "maxScore", "qualityPoints"] as const).map(
                    (field) => (
                      <Input
                        aria-label={`${gradeFieldLabels[field]} ${index + 1}`}
                        key={field}
                        min={0}
                        onChange={(event) =>
                          updateGradeEntry(
                            index,
                            field,
                            Number(event.target.value)
                          )
                        }
                        step="any"
                        type="number"
                        value={entry[field]}
                      />
                    )
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                disabled={
                  publishGradeScale.isPending ||
                  currentGradeEntries.length === 0
                }
                onClick={saveGradeScale}
                variant="outline"
              >
                <Save aria-hidden="true" />
                Publikasikan skala nilai
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default SettingsPage;

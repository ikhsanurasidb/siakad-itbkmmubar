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
import { useState } from "react";
import type { FormEvent } from "react";

export interface FieldDefinition {
  id: string;
  label: string;
  optional?: boolean;
  options?: readonly string[];
  type?: "date" | "number" | "select" | "text";
}

export interface SuggestionOption {
  description?: string;
  id: string;
  label: string;
}

export interface ReferenceSearchFieldProps {
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

const referenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

export const ReferenceSearchField = ({
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
  const [isFocused, setIsFocused] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    if (!normalizedValue) {
      return true;
    }
    return `${option.label} ${option.description ?? ""}`
      .toLowerCase()
      .includes(normalizedValue);
  });
  return (
    <FormField
      error={error}
      helper="Ketik untuk mencari, lalu pilih data aktif."
      id={id}
      label={label}
    >
      <div
        className="relative"
        onBlur={(event) => {
          const { relatedTarget } = event;
          if (
            relatedTarget instanceof HTMLElement &&
            event.currentTarget.contains(relatedTarget)
          ) {
            return;
          }
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
      >
        <Input
          aria-busy={loading}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          id={id}
          onChange={(event) => {
            onClear();
            onSearch(event.target.value.trimStart());
          }}
          value={value}
        />
        {isFocused && filteredOptions.length > 0 ? (
          <div
            aria-label={`Saran ${label}`}
            className="bg-background absolute z-10 mt-1 grid max-h-48 w-full gap-1 overflow-auto rounded-xl border p-1 shadow-lg"
          >
            {filteredOptions.map((option) => (
              <button
                className="hover:bg-muted grid gap-0.5 rounded-lg px-3 py-2 text-left text-sm"
                key={option.id}
                onClick={() => {
                  setIsFocused(false);
                  onSelect(option);
                }}
                type="button"
              >
                <span className="font-medium">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground text-xs">
                    {option.description}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {value && options.length === 0 && !loading ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Data aktif tidak ditemukan.
          </p>
        ) : null}
      </div>
    </FormField>
  );
};

interface MasterDataCreateFormProps {
  createPending: boolean;
  entityLabel: string;
  fields: readonly FieldDefinition[];
  hasSubmitted: boolean;
  onClearReference: (fieldId: string) => void;
  onSearchReference: (fieldId: string, value: string) => void;
  onSelectReference: (fieldId: string, option: SuggestionOption) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (fieldId: string, value: string) => void;
  referenceLabels: Record<string, string>;
  referenceLoading: Record<string, boolean>;
  referenceOptions: Record<string, readonly SuggestionOption[]>;
  values: Record<string, string>;
}

const MasterDataCreateForm = ({
  createPending,
  entityLabel,
  fields,
  hasSubmitted,
  onClearReference,
  onSearchReference,
  onSelectReference,
  onSubmit,
  onValueChange,
  referenceLabels,
  referenceLoading,
  referenceOptions,
  values,
}: MasterDataCreateFormProps) => (
  <Card className="overflow-visible">
    <CardHeader>
      <CardTitle>Tambah {entityLabel}</CardTitle>
      <CardDescription>
        Validasi dilakukan setelah formulir dikirim.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
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
                onClear={() => onClearReference(field.id)}
                onSearch={(value) => onSearchReference(field.id, value)}
                onSelect={(option) => onSelectReference(field.id, option)}
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
                    onValueChange(field.id, event.target.value)
                  }
                  value={values[field.id] ?? ""}
                >
                  <option value="">Pilih {field.label.toLowerCase()}</option>
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
                  onValueChange(field.id, event.target.value)
                }
                type={field.type ?? "text"}
                value={values[field.id] ?? ""}
              />
            </FormField>
          );
        })}
        <div className="flex items-end">
          <Button disabled={createPending} type="submit">
            {createPending ? "Menyimpan..." : "Simpan data"}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
);

export default MasterDataCreateForm;

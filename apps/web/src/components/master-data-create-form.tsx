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

const referenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

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
  <Card>
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

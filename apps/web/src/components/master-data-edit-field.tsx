import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { Input } from "@siakad-itbkmmubar/ui/components/input";

import { ReferenceSearchField } from "@/components/master-data-create-form";
import type {
  FieldDefinition,
  SuggestionOption,
} from "@/components/master-data-create-form";

const referenceFieldIds = new Set([
  "academicYearId",
  "cohortId",
  "studyProgramId",
]);

export interface MasterDataEditFieldProps {
  field: FieldDefinition;
  fieldValue: string;
  hasSubmitted: boolean;
  onClearReference: () => void;
  onSearchReference: (value: string) => void;
  onSelectReference: (option: SuggestionOption) => void;
  onValueChange: (value: string) => void;
  referenceLoading: boolean;
  referenceOptions: readonly SuggestionOption[];
  referenceValue: string;
}

const getFieldError = (
  field: FieldDefinition,
  fieldValue: string,
  hasSubmitted: boolean
): string | undefined => {
  if (hasSubmitted && !field.optional && !fieldValue.trim()) {
    return `${field.label} wajib diisi.`;
  }
  if (
    hasSubmitted &&
    field.id === "email" &&
    fieldValue &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(fieldValue)
  ) {
    return "Gunakan alamat email yang valid.";
  }
  if (
    hasSubmitted &&
    field.id === "phone" &&
    fieldValue &&
    !/^\+?[0-9]{10,15}$/u.test(fieldValue)
  ) {
    return "Gunakan 10–15 digit angka, boleh diawali tanda +.";
  }
  return undefined;
};

const MasterDataReferenceEditField = ({
  error,
  field,
  onClearReference,
  onSearchReference,
  onSelectReference,
  referenceLoading,
  referenceOptions,
  referenceValue,
}: {
  error?: string;
  field: FieldDefinition;
  onClearReference: () => void;
  onSearchReference: (value: string) => void;
  onSelectReference: (option: SuggestionOption) => void;
  referenceLoading: boolean;
  referenceOptions: readonly SuggestionOption[];
  referenceValue: string;
}) => (
  <ReferenceSearchField
    error={error}
    id={`edit-${field.id}`}
    label={field.label}
    loading={referenceLoading}
    onClear={onClearReference}
    onSearch={onSearchReference}
    onSelect={onSelectReference}
    options={referenceOptions}
    value={referenceValue}
  />
);

const MasterDataSelectEditField = ({
  error,
  field,
  fieldValue,
  onValueChange,
}: {
  error?: string;
  field: FieldDefinition;
  fieldValue: string;
  onValueChange: (value: string) => void;
}) => (
  <FormField
    error={error}
    id={`edit-${field.id}`}
    label={field.label}
    optional={field.optional}
  >
    <select
      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      id={`edit-${field.id}`}
      onChange={(event) => onValueChange(event.target.value)}
      value={fieldValue}
    >
      <option value="">Pilih {field.label.toLowerCase()}</option>
      {field.options?.map((option) => (
        <option key={option} value={option}>
          {field.optionLabels?.[option] ?? option}
        </option>
      ))}
    </select>
  </FormField>
);

const MasterDataTextEditField = ({
  error,
  field,
  fieldValue,
  onValueChange,
}: {
  error?: string;
  field: FieldDefinition;
  fieldValue: string;
  onValueChange: (value: string) => void;
}) => (
  <FormField
    error={error}
    id={`edit-${field.id}`}
    label={field.label}
    optional={field.optional}
  >
    <Input
      id={`edit-${field.id}`}
      onChange={(event) => onValueChange(event.target.value)}
      type={field.type ?? "text"}
      value={fieldValue}
    />
  </FormField>
);

export const MasterDataEditField = ({
  field,
  fieldValue,
  hasSubmitted,
  onClearReference,
  onSearchReference,
  onSelectReference,
  onValueChange,
  referenceLoading,
  referenceOptions,
  referenceValue,
}: MasterDataEditFieldProps) => {
  const error = getFieldError(field, fieldValue, hasSubmitted);
  if (referenceFieldIds.has(field.id)) {
    return (
      <MasterDataReferenceEditField
        error={error}
        field={field}
        onClearReference={onClearReference}
        onSearchReference={onSearchReference}
        onSelectReference={onSelectReference}
        referenceLoading={referenceLoading}
        referenceOptions={referenceOptions}
        referenceValue={referenceValue}
      />
    );
  }
  if (field.type === "select") {
    return (
      <MasterDataSelectEditField
        error={error}
        field={field}
        fieldValue={fieldValue}
        onValueChange={onValueChange}
      />
    );
  }
  return (
    <MasterDataTextEditField
      error={error}
      field={field}
      fieldValue={fieldValue}
      onValueChange={onValueChange}
    />
  );
};

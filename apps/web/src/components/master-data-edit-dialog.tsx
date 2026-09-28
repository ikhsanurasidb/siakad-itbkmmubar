import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { X } from "lucide-react";
import type { RefObject, FormEvent } from "react";

import type {
  FieldDefinition,
  SuggestionOption,
} from "@/components/master-data-create-form";
import { MasterDataEditField } from "@/components/master-data-edit-field";

interface MasterDataEditDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  entityLabel: string;
  fields: readonly FieldDefinition[];
  hasSubmitted: boolean;
  onCancel: () => void;
  onClearReference: (fieldId: string) => void;
  onSearchReference: (fieldId: string, value: string) => void;
  onSelectReference: (fieldId: string, option: SuggestionOption) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (fieldId: string, value: string) => void;
  referenceLabels: Record<string, string>;
  referenceLoading: Record<string, boolean>;
  referenceOptions: Record<string, readonly SuggestionOption[]>;
  resolvedReferenceLabels: Record<string, string>;
  updatePending: boolean;
  values: Record<string, string>;
}

export const MasterDataEditDialog = ({
  dialogRef,
  entityLabel,
  fields,
  hasSubmitted,
  onCancel,
  onClearReference,
  onSearchReference,
  onSelectReference,
  onSubmit,
  onValueChange,
  referenceLabels,
  referenceLoading,
  referenceOptions,
  resolvedReferenceLabels,
  updatePending,
  values,
}: MasterDataEditDialogProps) => (
  <dialog
    aria-labelledby="master-data-edit-dialog-title"
    className="bg-background text-foreground backdrop:bg-foreground/40 ring-border/70 m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl p-0 shadow-xl ring-1"
    onCancel={onCancel}
    ref={dialogRef}
  >
    <form
      className="grid max-h-[90svh] gap-5 overflow-auto p-5"
      onSubmit={onSubmit}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="font-semibold" id="master-data-edit-dialog-title">
            Ubah {entityLabel}
          </h2>
          <p className="text-muted-foreground text-sm">
            Simpan perubahan berdasarkan versi data yang sedang ditampilkan.
          </p>
        </div>
        <Button
          aria-label={`Tutup dialog ubah ${entityLabel.toLowerCase()}`}
          onClick={onCancel}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <MasterDataEditField
            field={field}
            fieldValue={values[field.id] ?? ""}
            hasSubmitted={hasSubmitted}
            key={field.id}
            onClearReference={() => onClearReference(field.id)}
            onSearchReference={(value) => onSearchReference(field.id, value)}
            onSelectReference={(option) => onSelectReference(field.id, option)}
            onValueChange={(value) => onValueChange(field.id, value)}
            referenceLoading={referenceLoading[field.id] ?? false}
            referenceOptions={referenceOptions[field.id] ?? []}
            referenceValue={
              resolvedReferenceLabels[field.id] ??
              referenceLabels[field.id] ??
              values[field.id] ??
              ""
            }
          />
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          Batal
        </Button>
        <Button disabled={updatePending} type="submit">
          {updatePending ? "Menyimpan..." : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  </dialog>
);

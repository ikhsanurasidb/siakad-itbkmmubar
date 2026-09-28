import { Combobox } from "@base-ui/react/combobox";
import { FormField } from "@siakad-itbkmmubar/ui/components/form-field";
import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import { Check, ChevronDown, CircleAlert, LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";

export interface SearchableSelectOption {
  description?: string;
  label: string;
  value: string;
}

export type SearchableSelectStatus = "error" | "loading" | "ready";

interface SearchableSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  id: string;
  label: string;
  loadingMessage?: string;
  onValueChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  optional?: boolean;
  placeholder?: string;
  status?: SearchableSelectStatus;
  value: string;
}

const inputClassName =
  "border-input text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 h-11 w-full min-w-0 rounded-xl border bg-transparent py-2 pr-20 pl-3.5 text-sm transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const getStatusMessage = (
  status: SearchableSelectStatus,
  loadingMessage: string,
  errorMessage: string
): ReactNode => {
  if (status === "loading") {
    return (
      <output aria-live="polite" className="inline-flex items-center gap-1.5">
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        {loadingMessage}
      </output>
    );
  }
  if (status === "error") {
    return (
      <span
        className="text-destructive inline-flex items-center gap-1.5"
        role="alert"
      >
        <CircleAlert aria-hidden="true" className="size-3.5" />
        {errorMessage}
      </span>
    );
  }
  return undefined;
};

const getPopupStatusMessage = (
  status: SearchableSelectStatus,
  loadingMessage: string,
  errorMessage: string
): string => {
  if (status === "loading") {
    return loadingMessage;
  }
  if (status === "error") {
    return errorMessage;
  }
  return "";
};

// eslint-disable-next-line complexity -- the component coordinates accessible combobox states and option rendering.
const SearchableSelect = ({
  disabled = false,
  emptyMessage = "Tidak ada pilihan yang cocok.",
  errorMessage = "Pilihan belum dapat dimuat.",
  id,
  label,
  loadingMessage = "Memuat pilihan…",
  onValueChange,
  options,
  optional = false,
  placeholder = "Ketik untuk mencari…",
  status = "ready",
  value,
}: SearchableSelectProps) => {
  const selectedOption = options.find((option) => option.value === value);
  const isDisabled = disabled || status !== "ready";
  const statusMessage = getStatusMessage(status, loadingMessage, errorMessage);
  const popupStatusMessage = getPopupStatusMessage(
    status,
    loadingMessage,
    errorMessage
  );
  let helperMessage: string | undefined;
  if (!statusMessage) {
    helperMessage =
      options.length === 0
        ? "Belum ada data yang dapat dipilih."
        : "Ketik untuk mencari, lalu pilih salah satu data.";
  }

  return (
    <FormField helper={helperMessage} id={id} label={label} optional={optional}>
      <Combobox.Root
        autoComplete="list"
        autoHighlight
        disabled={isDisabled}
        id={id}
        itemToStringLabel={(option: SearchableSelectOption | null) =>
          option?.label ?? ""
        }
        itemToStringValue={(option: SearchableSelectOption | null) =>
          option?.value ?? ""
        }
        items={options}
        onInputValueChange={(inputValue) => {
          if (
            (selectedOption && inputValue !== selectedOption.label) ||
            (!selectedOption && inputValue)
          ) {
            onValueChange("");
          }
        }}
        onValueChange={(option: SearchableSelectOption | null) => {
          onValueChange(option?.value ?? "");
        }}
        value={selectedOption ?? null}
      >
        <div className="relative">
          <Combobox.Input
            aria-busy={status === "loading"}
            aria-label={label}
            className={cn(
              inputClassName,
              status === "error" &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
            )}
            id={id}
            placeholder={placeholder}
          />
          {selectedOption ? (
            <Combobox.Clear
              aria-label={`Hapus pilihan ${label.toLowerCase()}`}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-9 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
              keepMounted
            >
              <X aria-hidden="true" className="size-4" />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            aria-label={`Buka pilihan ${label.toLowerCase()}`}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4}>
            <Combobox.Popup className="bg-popover text-popover-foreground z-50 max-h-72 min-w-[var(--anchor-width)] overflow-hidden rounded-xl border p-1 shadow-lg">
              <Combobox.Status className="text-muted-foreground px-3 py-2 text-sm">
                {popupStatusMessage}
              </Combobox.Status>
              {status === "ready" && options.length > 0 ? (
                <Combobox.List className="max-h-64 overflow-y-auto">
                  {options.map((option, index) => (
                    <Combobox.Item
                      className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-start gap-2 rounded-lg px-3 py-2 text-sm outline-none"
                      index={index}
                      key={option.value}
                      value={option}
                    >
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate">{option.label}</span>
                        {option.description ? (
                          <span className="text-muted-foreground truncate text-xs">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      <Combobox.ItemIndicator className="text-primary mt-0.5">
                        <Check aria-hidden="true" className="size-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  ))}
                </Combobox.List>
              ) : null}
              {status === "ready" && options.length === 0 ? (
                <div className="text-muted-foreground px-3 py-2 text-sm">
                  {emptyMessage}
                </div>
              ) : null}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {statusMessage ? (
        <p className="text-muted-foreground text-xs">{statusMessage}</p>
      ) : null}
    </FormField>
  );
};

export { SearchableSelect };

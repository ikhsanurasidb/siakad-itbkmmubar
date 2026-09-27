import { Label } from "@siakad-itbkmmubar/ui/components/label";
import type { ReactNode } from "react";

interface FormFieldProps {
  children: ReactNode;
  error?: string;
  helper?: string;
  id: string;
  label: string;
  optional?: boolean;
}

export const FormField = ({
  children,
  error,
  helper,
  id,
  label,
  optional,
}: FormFieldProps) => (
  <div className="grid gap-2">
    <Label htmlFor={id}>
      {label}
      {optional && <span className="text-muted-foreground">(opsional)</span>}
    </Label>
    {children}
    {error ? (
      <p className="text-destructive text-xs" id={`${id}-error`} role="alert">
        {error}
      </p>
    ) : (
      helper && <p className="text-muted-foreground text-xs">{helper}</p>
    )}
  </div>
);

interface FormErrorSummaryProps {
  count: number;
}

export const FormErrorSummary = ({ count }: FormErrorSummaryProps) => (
  <div
    aria-live="polite"
    className="border-destructive/40 bg-destructive/10 text-destructive border p-3 text-sm"
    role="alert"
  >
    <p className="font-medium">Periksa kembali formulir</p>
    <p className="mt-1 text-xs">
      Terdapat {count} kolom yang perlu diperbaiki.
    </p>
  </div>
);

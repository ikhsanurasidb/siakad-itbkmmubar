import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { Label } from "@siakad-itbkmmubar/ui/components/label";
import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

interface FileUploadProps {
  accept?: string;
  disabled?: boolean;
  helper?: string;
  label: string;
  maxBytes?: number;
  onFileChange: (file: File | null) => void;
}

const formatMegabytes = (bytes: number): string =>
  `${Math.floor(bytes / 1_000_000)} MB`;

export const FileUpload = ({
  accept,
  disabled,
  helper,
  label,
  maxBytes,
  onFileChange,
}: FileUploadProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const handleChange = (file: File | undefined) => {
    if (!file) {
      onFileChange(null);
      return;
    }

    if (maxBytes && file.size > maxBytes) {
      setError(`Ukuran file maksimal ${formatMegabytes(maxBytes)}.`);
      onFileChange(null);
      return;
    }

    setError(undefined);
    onFileChange(file);
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden="true" />
          Pilih file
        </Button>
        <Input
          accept={accept}
          className="sr-only"
          disabled={disabled}
          id={id}
          ref={inputRef}
          onChange={(event) => handleChange(event.target.files?.[0])}
          type="file"
        />
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : (
        helper && <p className="text-muted-foreground text-xs">{helper}</p>
      )}
    </div>
  );
};

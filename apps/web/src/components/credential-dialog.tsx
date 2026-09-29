import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { Clipboard, KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";

interface CredentialDialogProps {
  accountLabel: string;
  description: string;
  identifier: string;
  onClose: () => void;
  open: boolean;
  password: string;
  title: string;
}

const copyCredential = async (value: string, label: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error(`${label} belum dapat disalin.`);
  }
};

const CredentialDialog = ({
  accountLabel,
  description,
  identifier,
  onClose,
  open,
  password,
  title,
}: CredentialDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="bg-background text-foreground backdrop:bg-foreground/40 ring-border/70 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 shadow-xl ring-1"
      onCancel={onClose}
      ref={dialogRef}
    >
      <div className="grid max-h-[90svh] gap-5 overflow-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="flex items-center gap-2 font-semibold" id={titleId}>
              <KeyRound aria-hidden="true" className="size-5" />
              {title}
            </h2>
            <p className="text-sm font-medium">{accountLabel}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <Button
            aria-label="Tutup dialog kredensial"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-muted/40 grid gap-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium">
              Identitas / ID login
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="font-semibold break-all">{identifier}</code>
              <Button
                aria-label="Salin identitas"
                onClick={() => copyCredential(identifier, "Identitas")}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <Clipboard aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="bg-muted/40 grid gap-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium">
              Kata sandi sementara
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="font-semibold break-all">{password}</code>
              <Button
                aria-label="Salin kata sandi sementara"
                onClick={() => copyCredential(password, "Kata sandi sementara")}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <Clipboard aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} type="button">
            Selesai
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default CredentialDialog;

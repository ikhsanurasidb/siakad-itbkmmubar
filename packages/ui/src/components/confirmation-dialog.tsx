import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ConfirmationDialogProps {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}

export const ConfirmationDialog = ({
  cancelLabel = "Batal",
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="confirmation-dialog-title"
      className="bg-background text-foreground backdrop:bg-foreground/40 ring-border/70 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl ring-1"
      onCancel={onCancel}
      ref={dialogRef}
    >
      <div className="grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="font-medium" id="confirmation-dialog-title">
            {title}
          </h2>
          {children && (
            <div className="text-muted-foreground text-sm">{children}</div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
};

import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface FilePreviewDialogProps {
  children: ReactNode;
  fileName: string;
  onClose: () => void;
  open: boolean;
}

export const FilePreviewDialog = ({
  children,
  fileName,
  onClose,
  open,
}: FilePreviewDialogProps) => {
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
      aria-labelledby="file-preview-title"
      className="bg-background text-foreground backdrop:bg-foreground/40 m-auto w-[calc(100%-2rem)] max-w-4xl border p-0 shadow-xl"
      onCancel={onClose}
      ref={dialogRef}
    >
      <div className="grid max-h-[90svh] gap-4 overflow-auto p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="truncate font-medium" id="file-preview-title">
            {fileName}
          </h2>
          <Button
            aria-label="Tutup pratinjau"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div>{children}</div>
      </div>
    </dialog>
  );
};

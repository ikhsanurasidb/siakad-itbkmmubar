import { ConfirmationDialog } from "@siakad-itbkmmubar/ui/components/confirmation-dialog";

interface CurriculumCatalogImportDialogProps {
  curriculumProgramName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

const CurriculumCatalogImportDialog = ({
  curriculumProgramName,
  isPending,
  onCancel,
  onConfirm,
  open,
}: CurriculumCatalogImportDialogProps) => (
  <ConfirmationDialog
    confirmLabel={isPending ? "Mengimpor..." : "Impor mata kuliah"}
    onCancel={onCancel}
    onConfirm={onConfirm}
    open={open}
    title="Impor mata kuliah dari katalog?"
  >
    {`Mata kuliah aktif dari Prodi ${curriculumProgramName} yang memiliki semester bawaan 1–8 akan ditambahkan ke struktur. Mata kuliah yang sudah ada tidak akan diduplikasi.`}
  </ConfirmationDialog>
);

export default CurriculumCatalogImportDialog;

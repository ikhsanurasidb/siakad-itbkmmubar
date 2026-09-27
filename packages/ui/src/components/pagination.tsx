import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pageLabel?: string;
}

export const Pagination = ({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  pageLabel = "Halaman saat ini",
}: PaginationProps) => (
  <nav
    aria-label="Navigasi halaman"
    className="flex items-center justify-between gap-4"
  >
    <span className="text-muted-foreground text-sm">{pageLabel}</span>
    <div className="flex gap-2">
      <Button
        aria-label="Halaman sebelumnya"
        disabled={!hasPreviousPage}
        onClick={onPrevious}
        size="icon"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        aria-label="Halaman berikutnya"
        disabled={!hasNextPage}
        onClick={onNext}
        size="icon"
        variant="outline"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  </nav>
);

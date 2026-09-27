import type { FormEventHandler, ReactNode } from "react";

interface FilterBarProps {
  children: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}

export const FilterBar = ({ children, onSubmit }: FilterBarProps) => (
  <form
    className="border-border bg-muted/20 flex flex-wrap items-end gap-3 border p-3"
    onSubmit={onSubmit}
  >
    {children}
  </form>
);

import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  action?: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  title: string;
}

export const PageHeader = ({
  action,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) => (
  <header
    className={cn("flex flex-wrap items-end justify-between gap-4", className)}
  >
    <div className="grid gap-1">
      {eyebrow && (
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

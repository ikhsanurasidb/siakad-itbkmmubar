import {
  AlertCircle,
  CheckCircle2,
  FileQuestion,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";

type StateVariant = "error" | "forbidden" | "loading" | "not-found" | "success";

interface StateProps {
  action?: ReactNode;
  description: string;
  title: string;
  variant: StateVariant;
}

const icons = {
  error: AlertCircle,
  forbidden: ShieldAlert,
  loading: LoaderCircle,
  "not-found": FileQuestion,
  success: CheckCircle2,
} as const;

export const State = ({ action, description, title, variant }: StateProps) => {
  const Icon = icons[variant];

  return (
    <section
      aria-live={variant === "loading" ? "polite" : undefined}
      className="grid justify-items-center gap-3 p-8 text-center"
      role={variant === "error" ? "alert" : undefined}
    >
      <Icon
        aria-hidden="true"
        className={
          variant === "loading"
            ? "size-6 animate-spin"
            : "text-muted-foreground size-6"
        }
      />
      <div className="grid max-w-md gap-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </section>
  );
};

export { Button as StateAction } from "@siakad-itbkmmubar/ui/components/button";

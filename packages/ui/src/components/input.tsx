import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import * as React from "react";

const Input = ({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) => (
  <InputPrimitive
    type={type}
    data-slot="input"
    className={cn(
      "border-input text-foreground file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-11 w-full min-w-0 rounded-xl border bg-transparent px-3.5 py-2 text-sm transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1",
      className
    )}
    {...props}
  />
);

export { Input };

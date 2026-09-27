import { Label } from "@siakad-itbkmmubar/ui/components/label";

interface RoleOption {
  label: string;
  value: string;
}

interface RoleSwitcherProps {
  onChange: (role: string) => void;
  options: readonly RoleOption[];
  value: string;
}

export const RoleSwitcher = ({
  onChange,
  options,
  value,
}: RoleSwitcherProps) => {
  const id = "active-role";

  return (
    <div className="grid gap-1">
      <Label className="text-muted-foreground text-[11px]" htmlFor={id}>
        Peran aktif
      </Label>
      <select
        className="border-input bg-background h-8 border px-2 text-xs outline-none focus-visible:ring-1"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export type { RoleOption };

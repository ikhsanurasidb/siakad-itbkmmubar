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
      <Label className="text-muted-foreground text-xs" htmlFor={id}>
        Peran aktif
      </Label>
      <select
        className="border-input bg-background h-10 rounded-xl border px-3 text-base outline-none focus-visible:ring-2"
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

import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";

const navigation = [
  { icon: LayoutDashboard, label: "Beranda", to: "/" },
  { icon: ShieldCheck, label: "Dashboard", to: "/dashboard" },
  { icon: LogIn, label: "Masuk", to: "/login" },
] as const;

const Sidebar = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="border-border hidden w-60 shrink-0 border-r lg:block">
      <nav aria-label="Navigasi utama" className="sticky top-14 p-3">
        <p className="text-muted-foreground px-3 pb-2 text-[11px] font-medium tracking-wider uppercase">
          Navigasi
        </p>
        <ul className="grid gap-1">
          {navigation.map(({ icon: Icon, label, to }) => {
            const isActive = pathname === to;
            return (
              <li key={to}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                  to={to}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

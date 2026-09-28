import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { NotificationCenter } from "@siakad-itbkmmubar/ui/components/notification-center";
import { SidebarTrigger } from "@siakad-itbkmmubar/ui/components/sidebar";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";

interface HeaderProps {
  userName: string;
}

const Header = ({ userName }: HeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    await navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="md:hidden" />
          <Link className="flex min-w-0 items-center gap-3" to="/dashboard">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#12395c] text-sm font-bold text-white shadow-sm">
              S
            </span>
            <span className="hidden truncate text-sm font-bold tracking-wide text-[#12395c] sm:inline">
              SIAKAD ITB KMMU BAR
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationCenter />
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <span className="grid size-7 place-items-center rounded-lg bg-[#e8eff6] text-[#12395c]">
              <UserRound aria-hidden="true" className="size-4" />
            </span>
            <span className="max-w-36 truncate text-xs font-semibold text-slate-700">
              {userName}
            </span>
          </div>
          <Button
            aria-label="Keluar dari sistem"
            className="text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            onClick={handleLogout}
            size="icon"
            variant="ghost"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;

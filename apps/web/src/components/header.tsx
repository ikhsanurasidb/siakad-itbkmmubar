import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@siakad-itbkmmubar/ui/components/dropdown-menu";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { NotificationCenter } from "@siakad-itbkmmubar/ui/components/notification-center";
import { SidebarTrigger } from "@siakad-itbkmmubar/ui/components/sidebar";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, CircleHelp, Home, LogOut, Search } from "lucide-react";

import { authClient } from "@/lib/auth-client";

interface HeaderProps {
  userName: string;
}

const getInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/u)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "AA";
};

const Header = ({ userName }: HeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    await navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-20 h-20 border-b border-[#dbe5ee] bg-white">
      <div className="flex h-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <SidebarTrigger className="md:hidden" />
          <Link
            aria-label="Kembali ke Beranda"
            className="flex items-center gap-3 text-[#102d4d]"
            to="/dashboard"
          >
            <Home aria-hidden="true" className="size-[18px] fill-current" />
            <span className="text-[#9aabba]">/</span>
            <span className="hidden text-sm font-semibold sm:inline">
              Beranda
            </span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <div className="relative hidden w-full max-w-[22rem] lg:block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[#8192a6]"
            />
            <Input
              aria-label="Cari menu atau halaman"
              className="h-11 rounded-lg border-[#d9e3ed] bg-[#f8fafc] pl-11 text-[#102d4d] placeholder:text-[#8192a6] focus-visible:border-[#1d78d4]"
              placeholder="Cari menu atau halaman..."
              type="search"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <NotificationCenter unreadCount={3} />

          <Button
            aria-label="Bantuan"
            className="text-[#102d4d] hover:bg-[#eef4f9] hover:text-[#0b559c]"
            size="icon"
            variant="ghost"
          >
            <CircleHelp aria-hidden="true" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="hidden h-11 items-center gap-2 rounded-lg border border-[#dbe5ee] bg-[#f8fafc] px-3 text-xs font-semibold text-[#102d4d] transition-colors outline-none hover:bg-[#eef4f9] focus-visible:ring-2 focus-visible:ring-[#1d78d4]/30 lg:flex">
              <span>Admin Akademik</span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-[#71859c]"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-xl border-[#dbe5ee] p-1"
            >
              <DropdownMenuLabel className="px-3 text-[#71859c]">
                Peran aktif
              </DropdownMenuLabel>
              <DropdownMenuItem className="rounded-lg px-3 text-[#102d4d] focus:bg-[#eef4f9]">
                Admin Akademik
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-11 items-center gap-2 rounded-lg px-1.5 text-left text-[#102d4d] transition-colors outline-none hover:bg-[#eef4f9] focus-visible:ring-2 focus-visible:ring-[#1d78d4]/30 sm:gap-3 sm:px-2">
              <span className="grid size-9 place-items-center rounded-full bg-[#d9a83f] text-xs font-bold text-white">
                {getInitials(userName)}
              </span>
              <span className="hidden max-w-32 truncate text-xs font-semibold xl:inline">
                {userName}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="hidden size-4 text-[#71859c] sm:inline"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-[#dbe5ee] p-1"
            >
              <DropdownMenuLabel className="px-3 text-[#102d4d]">
                <span className="block truncate">{userName}</span>
                <span className="mt-1 block text-xs font-normal text-[#71859c]">
                  Admin Akademik
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#e7edf3]" />
              <DropdownMenuItem
                className="rounded-lg px-3 text-[#b42318] focus:bg-[#fff1f0] focus:text-[#b42318]"
                onClick={handleLogout}
              >
                <LogOut aria-hidden="true" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;

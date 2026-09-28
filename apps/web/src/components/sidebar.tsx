import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@siakad-itbkmmubar/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Home,
  Laptop,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Settings,
  UsersRound,
} from "lucide-react";

const primaryNavigation = [
  { active: true, icon: Home, label: "Beranda", to: "/dashboard" },
  {
    active: false,
    icon: LayoutDashboard,
    label: "Dashboard",
    to: "/dashboard",
  },
] as const;

const academicNavigation = [
  {
    icon: UsersRound,
    label: "Identitas & Akses",
    to: "/superadmin/identitas/akun",
  },
  { icon: ClipboardList, label: "Master Data", to: "/dashboard" },
  { icon: BookOpen, label: "Kurikulum", to: "/dashboard" },
  { icon: FileText, label: "KRS Paket", to: "/dashboard" },
  { icon: UsersRound, label: "Kelas Kuliah", to: "/dashboard" },
  { icon: CalendarDays, label: "Jadwal", to: "/dashboard" },
  { icon: Laptop, label: "LMS", to: "/dashboard" },
  { icon: CheckCircle2, label: "Presensi", to: "/dashboard" },
  { icon: FileText, label: "Nilai", to: "/dashboard" },
  { icon: GraduationCap, label: "KHS & Transkrip", to: "/dashboard" },
] as const;

const systemNavigation = [
  { icon: Settings, label: "Pengaturan", to: "/dashboard" },
  { icon: History, label: "Audit Log", to: "/dashboard" },
  { icon: Bell, label: "Notifikasi", to: "/dashboard" },
] as const;

const Sidebar = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { setOpenMobile, state, toggleSidebar } = useSidebar();

  const renderNavigation = (
    items: readonly {
      active?: boolean;
      icon: typeof Home;
      label: string;
      to: "/dashboard" | "/superadmin/identitas/akun";
    }[]
  ) => (
    <SidebarMenu>
      {items.map(({ active = true, icon: Icon, label, to }) => {
        const isActive =
          active && (pathname === to || pathname.startsWith(`${to}/`));

        return (
          <SidebarMenuItem key={label}>
            <SidebarMenuButton
              isActive={isActive}
              render={
                <Link
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpenMobile(false)}
                  to={to}
                />
              }
              title={label}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <SidebarPrimitive collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-sidebar-border/60 h-20 justify-center border-b px-5 py-0">
        <Link
          aria-label="SIAKAD ITB KMMU BAR"
          className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center"
          to="/dashboard"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-white text-lg font-bold text-[#12395c] shadow-sm">
            S
          </span>
          <span className="truncate text-sm font-bold tracking-wide text-white group-data-[collapsible=icon]:hidden">
            SIAKAD ITB KMMU BAR
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            {renderNavigation(primaryNavigation)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Akademik</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavigation(academicNavigation)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistem</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavigation(systemNavigation)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border/60 border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              title={
                state === "expanded" ? "Sembunyikan Menu" : "Tampilkan Menu"
              }
            >
              {state === "expanded" ? (
                <PanelLeftClose aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
              <span>
                {state === "expanded" ? "Sembunyikan Menu" : "Tampilkan Menu"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
  );
};

export default Sidebar;

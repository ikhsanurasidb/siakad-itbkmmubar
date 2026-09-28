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
  BookOpenText,
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const navigation = [
  { icon: LayoutDashboard, label: "Beranda", to: "/dashboard" },
  {
    icon: BookOpenText,
    label: "Akun identitas",
    to: "/superadmin/identitas/akun",
  },
  {
    icon: ClipboardCheck,
    label: "Role sistem",
    to: "/superadmin/identitas/roles",
  },
  { icon: ShieldCheck, label: "Keamanan akun", to: "/akun/keamanan" },
] as const;

const Sidebar = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarPrimitive collapsible="offcanvas" variant="sidebar">
      <SidebarHeader>
        <Link className="flex items-center gap-3" to="/dashboard">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-10 place-items-center rounded-xl text-lg font-bold shadow-lg shadow-slate-950/10">
            S
          </span>
          <span className="grid gap-0.5">
            <span className="text-sidebar-foreground text-sm font-bold tracking-wide">
              SIAKAD ITB KMMU BAR
            </span>
            <span className="text-sidebar-foreground/55 text-xs tracking-[0.18em] uppercase">
              Portal akademik
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({ icon: Icon, label, to }) => {
                const isActive =
                  pathname === to || pathname.startsWith(`${to}/`);
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                          to={to}
                        />
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Akses cepat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      onClick={() => setOpenMobile(false)}
                      to="/admin-akademik/identitas/akun"
                    />
                  }
                >
                  <UserRound aria-hidden="true" />
                  <span>Kelola akun akademik</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="border-sidebar-border/70 bg-sidebar-accent/60 rounded-2xl border p-3">
          <p className="text-sidebar-foreground text-xs font-semibold">
            Butuh bantuan?
          </p>
          <p className="text-sidebar-foreground/60 mt-1 text-xs leading-5">
            Hubungi Admin Akademik untuk kendala akses akun.
          </p>
        </div>
      </SidebarFooter>
    </SidebarPrimitive>
  );
};

export default Sidebar;

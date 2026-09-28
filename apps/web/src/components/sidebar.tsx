import type { RoleKey } from "@siakad-itbkmmubar/api/identity";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@siakad-itbkmmubar/ui/components/collapsible";
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
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Database,
  GraduationCap,
  Home,
  KeyRound,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavigationItem {
  children?: readonly NavigationItem[];
  icon: LucideIcon;
  label: string;
  roles?: readonly RoleKey[];
  to?: string;
}

interface NavigationSection {
  items: readonly NavigationItem[];
  label?: string;
}

interface NavigationNodeProps {
  item: NavigationItem;
  pathname: string;
  setOpenMobile: (open: boolean) => void;
}

interface SidebarProps {
  roles: readonly RoleKey[];
}

const SUPERADMIN: readonly RoleKey[] = ["SUPERADMIN"];
const ACADEMIC_ADMIN: readonly RoleKey[] = ["ADMIN_AKADEMIK"];

const superadminMasterDataItems: readonly NavigationItem[] = [
  {
    icon: Database,
    label: "Ringkasan",
    roles: SUPERADMIN,
    to: "/superadmin/master-data",
  },
  {
    icon: UserRound,
    label: "Mahasiswa",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/mahasiswa",
  },
  {
    icon: GraduationCap,
    label: "Dosen",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/dosen",
  },
  {
    icon: BookOpen,
    label: "Program Studi",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/prodi",
  },
  {
    icon: UsersRound,
    label: "Angkatan",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/angkatan",
  },
  {
    icon: BookOpen,
    label: "Mata Kuliah",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/mata-kuliah",
  },
  {
    icon: Building2,
    label: "Ruang",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/ruang",
  },
  {
    icon: CalendarDays,
    label: "Semester",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/semester",
  },
  {
    icon: Upload,
    label: "Impor data master",
    roles: SUPERADMIN,
    to: "/superadmin/master-data/import",
  },
];

const academicAdminMasterDataItems: readonly NavigationItem[] = [
  {
    icon: Database,
    label: "Ringkasan",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data",
  },
  {
    icon: UserRound,
    label: "Mahasiswa",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/mahasiswa",
  },
  {
    icon: GraduationCap,
    label: "Dosen",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/dosen",
  },
  {
    icon: BookOpen,
    label: "Program Studi",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/prodi",
  },
  {
    icon: UsersRound,
    label: "Angkatan",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/angkatan",
  },
  {
    icon: BookOpen,
    label: "Mata Kuliah",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/mata-kuliah",
  },
  {
    icon: Building2,
    label: "Ruang",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/ruang",
  },
  {
    icon: CalendarDays,
    label: "Semester",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/semester",
  },
  {
    icon: Upload,
    label: "Impor data master",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/master-data/import",
  },
];

const superadminIdentityItems: readonly NavigationItem[] = [
  {
    icon: UserRound,
    label: "Akun identitas",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/akun",
  },
  {
    icon: ShieldCheck,
    label: "Role sistem",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/roles",
  },
  {
    icon: KeyRound,
    label: "Scope akses",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/scopes",
  },
];

const academicAdminIdentityItems: readonly NavigationItem[] = [
  {
    icon: UserRound,
    label: "Akun akademik",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/identitas/akun",
  },
];

const navigationSections: readonly NavigationSection[] = [
  {
    items: [{ icon: Home, label: "Beranda", to: "/dashboard" }],
  },
  {
    items: [
      {
        children: superadminIdentityItems,
        icon: ShieldCheck,
        label: "Superadmin",
        roles: SUPERADMIN,
      },
      {
        children: academicAdminIdentityItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
    ],
    label: "Identitas & Akses",
  },
  {
    items: [
      {
        children: superadminMasterDataItems,
        icon: ShieldCheck,
        label: "Superadmin",
        roles: SUPERADMIN,
      },
      {
        children: academicAdminMasterDataItems,
        icon: Database,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
    ],
    label: "Data master",
  },
  {
    items: [{ icon: Settings, label: "Keamanan akun", to: "/akun/keamanan" }],
    label: "Sistem",
  },
];

const isAllowed = (
  item: NavigationItem,
  roles: ReadonlySet<RoleKey>
): boolean => !item.roles || item.roles.some((role) => roles.has(role));

const getVisibleItemsForRoles = (
  items: readonly NavigationItem[],
  roles: ReadonlySet<RoleKey>
): NavigationItem[] =>
  items.flatMap((item) => {
    if (!isAllowed(item, roles)) {
      return [];
    }

    const visibleChildren = item.children
      ? getVisibleItemsForRoles(item.children, roles)
      : undefined;

    if (item.children && !visibleChildren?.length) {
      return [];
    }

    return [{ ...item, children: visibleChildren }];
  });

const getVisibleItems = (
  items: readonly NavigationItem[],
  roles: readonly RoleKey[]
): NavigationItem[] => getVisibleItemsForRoles(items, new Set(roles));

const isPathActive = (pathname: string, item: NavigationItem): boolean => {
  const itemIsActive = item.to
    ? pathname === item.to || pathname.startsWith(`${item.to}/`)
    : false;

  return (
    itemIsActive ||
    Boolean(item.children?.some((child) => isPathActive(pathname, child)))
  );
};

const NavigationNode = ({
  item,
  pathname,
  setOpenMobile,
}: NavigationNodeProps) => {
  const { children, icon: Icon, label, to } = item;
  const isActive = isPathActive(pathname, item);

  if (!children?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          render={
            <Link
              aria-current={isActive ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
              to={to ?? "/dashboard"}
            />
          }
          title={label}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible className="group/collapsible" defaultOpen={isActive}>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton isActive={isActive} title={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <ChevronRight
                aria-hidden="true"
                className="ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[open]/collapsible:rotate-90"
              />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <SidebarMenu className="border-sidebar-border/50 mt-1 ml-3 gap-1 border-l pl-2">
            {children.map((child) => (
              <NavigationNode
                item={child}
                key={child.label}
                pathname={pathname}
                setOpenMobile={setOpenMobile}
              />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};

const Sidebar = ({ roles }: SidebarProps) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { setOpenMobile, state, toggleSidebar } = useSidebar();

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
        {navigationSections.map((section) => {
          const visibleItems = getVisibleItems(section.items, roles);
          if (!visibleItems.length) {
            return null;
          }

          return (
            <SidebarGroup key={section.label ?? "primary"}>
              {section.label && (
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <NavigationNode
                      item={item}
                      key={item.label}
                      pathname={pathname}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
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

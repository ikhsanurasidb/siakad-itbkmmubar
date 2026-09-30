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
  Camera,
  ClipboardList,
  ChevronRight,
  Database,
  FileSliders,
  GraduationCap,
  Home,
  KeyRound,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

interface NavigationItem {
  activePaths?: readonly string[];
  children?: readonly NavigationItem[];
  icon: LucideIcon;
  label: string;
  roles?: readonly RoleKey[];
  to?: string;
}

interface NavigationSection {
  id?: string;
  items: readonly NavigationItem[];
  label?: string;
}

interface NavigationNodeProps {
  item: NavigationItem;
  pathname: string;
  setOpenMobile: (open: boolean) => void;
}

interface NavigationModuleProps {
  items: readonly NavigationItem[];
  label: string;
  pathname: string;
  setOpenMobile: (open: boolean) => void;
  sidebarState: "collapsed" | "expanded";
}

interface SidebarProps {
  roles: readonly RoleKey[];
}

const SUPERADMIN: readonly RoleKey[] = ["SUPERADMIN"];
const ACADEMIC_ADMIN: readonly RoleKey[] = ["ADMIN_AKADEMIK"];
const PROGRAM_HEAD: readonly RoleKey[] = ["KAPRODI"];
const STUDENT: readonly RoleKey[] = ["MAHASISWA"];
const LECTURER: readonly RoleKey[] = ["DOSEN"];

const superadminSchedulingItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Kelas dan jadwal",
    roles: SUPERADMIN,
    to: "/superadmin/kelas",
  },
];

const academicAdminSchedulingItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Kelas dan jadwal",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/kelas",
  },
  {
    icon: SlidersHorizontal,
    label: "Pemetaan kelas",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/kelas/pemetaan",
  },
];

const programHeadSchedulingItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Kelas dan jadwal",
    roles: PROGRAM_HEAD,
    to: "/kaprodi/jadwal/persetujuan",
  },
];

const lecturerSchedulingItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Jadwal mengajar",
    roles: LECTURER,
    to: "/dosen/jadwal",
  },
];

const lecturerLearningItems: readonly NavigationItem[] = [
  {
    icon: BookOpen,
    label: "Ruang pembelajaran",
    roles: LECTURER,
    to: "/dosen/lms",
  },
];

const lecturerAttendanceItems: readonly NavigationItem[] = [
  {
    icon: Camera,
    label: "Presensi",
    roles: LECTURER,
    to: "/dosen/presensi",
  },
];

const studentSchedulingItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Jadwal kuliah",
    roles: STUDENT,
    to: "/mahasiswa/jadwal",
  },
];

const nationalCalendarItem: NavigationItem = {
  icon: CalendarDays,
  label: "Kalender nasional",
  roles: ["SUPERADMIN", "ADMIN_AKADEMIK", "KAPRODI", "DOSEN", "MAHASISWA"],
  to: "/kalender-nasional",
};

const studentLearningItems: readonly NavigationItem[] = [
  {
    icon: BookOpen,
    label: "Ruang pembelajaran",
    roles: STUDENT,
    to: "/mahasiswa/lms",
  },
];

const studentAttendanceItems: readonly NavigationItem[] = [
  {
    icon: Camera,
    label: "Presensi",
    roles: STUDENT,
    to: "/mahasiswa/presensi",
  },
];

const programHeadAttendanceItems: readonly NavigationItem[] = [
  {
    icon: Camera,
    label: "Tinjauan presensi",
    roles: PROGRAM_HEAD,
    to: "/kaprodi/presensi",
  },
];

const academicAdminAttendanceItems: readonly NavigationItem[] = [
  {
    icon: Camera,
    label: "Tinjauan presensi",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/presensi",
  },
];

const superadminCurriculumItems: readonly NavigationItem[] = [
  {
    icon: Database,
    label: "Kurikulum",
    roles: SUPERADMIN,
    to: "/superadmin/kurikulum",
  },
];

const programHeadCurriculumItems: readonly NavigationItem[] = [
  {
    icon: Database,
    label: "Kurikulum",
    roles: PROGRAM_HEAD,
    to: "/kaprodi/kurikulum",
  },
];

const academicAdminCurriculumItems: readonly NavigationItem[] = [
  {
    icon: Database,
    label: "Kurikulum",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/kurikulum",
  },
];

const academicAdminStudyPlanItems: readonly NavigationItem[] = [
  {
    icon: ClipboardList,
    label: "KRS Paket",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/krs",
  },
  {
    icon: FileSliders,
    label: "Buat KRS Paket",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/krs/generate",
  },
];

const superadminStudyPlanItems: readonly NavigationItem[] = [
  {
    icon: ClipboardList,
    label: "KRS Paket",
    roles: SUPERADMIN,
    to: "/superadmin/krs",
  },
  {
    icon: FileSliders,
    label: "Buat KRS Paket",
    roles: SUPERADMIN,
    to: "/superadmin/krs/generate",
  },
];

const programHeadStudyPlanItems: readonly NavigationItem[] = [
  {
    icon: ClipboardList,
    label: "KRS Paket",
    roles: PROGRAM_HEAD,
    to: "/kaprodi/krs",
  },
];

const studentStudyPlanItems: readonly NavigationItem[] = [
  {
    icon: ClipboardList,
    label: "KRS semester ini",
    roles: STUDENT,
    to: "/mahasiswa/krs",
  },
];

const lecturerGradeItems: readonly NavigationItem[] = [
  {
    icon: GraduationCap,
    label: "Nilai kelas",
    roles: LECTURER,
    to: "/dosen/nilai",
  },
];

const academicAdminGradeItems: readonly NavigationItem[] = [
  {
    icon: CalendarDays,
    label: "Periode nilai",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/nilai/periode",
  },
  {
    icon: GraduationCap,
    label: "Publikasi nilai",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/nilai/publikasi",
  },
];

const programHeadGradeItems: readonly NavigationItem[] = [
  {
    icon: GraduationCap,
    label: "Nilai Prodi",
    roles: PROGRAM_HEAD,
    to: "/kaprodi/nilai",
  },
];

const studentGradeItems: readonly NavigationItem[] = [
  {
    icon: GraduationCap,
    label: "Nilai dan KHS",
    roles: STUDENT,
    to: "/mahasiswa/nilai",
  },
  {
    icon: FileSliders,
    label: "Transkrip",
    roles: STUDENT,
    to: "/mahasiswa/transkrip",
  },
];

const settingsItems: readonly NavigationItem[] = [
  {
    icon: SlidersHorizontal,
    label: "Ringkasan",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan",
  },
  {
    icon: ShieldCheck,
    label: "Keamanan",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/keamanan",
  },
  {
    icon: CalendarDays,
    label: "Penjadwalan",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/penjadwalan",
  },
  {
    icon: ClipboardList,
    label: "Presensi",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/presensi",
  },
  {
    icon: GraduationCap,
    label: "Nilai",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/nilai",
  },
  {
    icon: FileSliders,
    label: "Berkas",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/file",
  },
  {
    icon: Database,
    label: "Impor dan proses",
    roles: SUPERADMIN,
    to: "/superadmin/pengaturan/database-job",
  },
];

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
    icon: UserRoundPlus,
    label: "Tambah admin",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/admin",
  },
  {
    icon: UserRound,
    label: "Akun identitas",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/akun",
  },
  {
    icon: GraduationCap,
    label: "Assignment Kaprodi",
    roles: SUPERADMIN,
    to: "/superadmin/identitas/kaprodi",
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
  {
    icon: GraduationCap,
    label: "Assignment Kaprodi",
    roles: ACADEMIC_ADMIN,
    to: "/admin-akademik/identitas/kaprodi",
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
    items: [
      {
        children: superadminCurriculumItems,
        icon: ShieldCheck,
        label: "Superadmin",
        roles: SUPERADMIN,
      },
      {
        children: programHeadCurriculumItems,
        icon: GraduationCap,
        label: "Kaprodi",
        roles: PROGRAM_HEAD,
      },
      {
        children: academicAdminCurriculumItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
    ],
    label: "Kurikulum",
  },
  {
    items: [
      {
        children: superadminStudyPlanItems,
        icon: ShieldCheck,
        label: "Superadmin",
        roles: SUPERADMIN,
      },
      {
        children: academicAdminStudyPlanItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
      {
        children: programHeadStudyPlanItems,
        icon: GraduationCap,
        label: "Kaprodi",
        roles: PROGRAM_HEAD,
      },
      {
        children: studentStudyPlanItems,
        icon: UserRound,
        label: "Mahasiswa",
        roles: STUDENT,
      },
    ],
    label: "KRS",
  },
  {
    items: [
      {
        children: superadminSchedulingItems,
        icon: ShieldCheck,
        label: "Superadmin",
        roles: SUPERADMIN,
      },
      {
        children: academicAdminSchedulingItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
      {
        children: programHeadSchedulingItems,
        icon: GraduationCap,
        label: "Kaprodi",
        roles: PROGRAM_HEAD,
      },
      {
        children: lecturerSchedulingItems,
        icon: GraduationCap,
        label: "Dosen",
        roles: LECTURER,
      },
      {
        children: studentSchedulingItems,
        icon: UserRound,
        label: "Mahasiswa",
        roles: STUDENT,
      },
    ],
    label: "Kelas dan jadwal",
  },
  {
    id: "national-calendar",
    items: [nationalCalendarItem],
  },
  {
    items: [
      {
        children: lecturerLearningItems,
        icon: GraduationCap,
        label: "Dosen",
        roles: LECTURER,
      },
      {
        children: studentLearningItems,
        icon: UserRound,
        label: "Mahasiswa",
        roles: STUDENT,
      },
    ],
    label: "Ruang pembelajaran",
  },
  {
    items: [
      {
        children: academicAdminAttendanceItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
      {
        children: programHeadAttendanceItems,
        icon: GraduationCap,
        label: "Kaprodi",
        roles: PROGRAM_HEAD,
      },
      {
        children: lecturerAttendanceItems,
        icon: GraduationCap,
        label: "Dosen",
        roles: LECTURER,
      },
      {
        children: studentAttendanceItems,
        icon: UserRound,
        label: "Mahasiswa",
        roles: STUDENT,
      },
    ],
    label: "Presensi",
  },
  {
    items: [
      {
        children: academicAdminGradeItems,
        icon: UsersRound,
        label: "Admin Akademik",
        roles: ACADEMIC_ADMIN,
      },
      {
        children: programHeadGradeItems,
        icon: GraduationCap,
        label: "Kaprodi",
        roles: PROGRAM_HEAD,
      },
      {
        children: lecturerGradeItems,
        icon: GraduationCap,
        label: "Dosen",
        roles: LECTURER,
      },
      {
        children: studentGradeItems,
        icon: UserRound,
        label: "Mahasiswa",
        roles: STUDENT,
      },
    ],
    label: "Nilai dan hasil studi",
  },
  {
    items: [
      { icon: Settings, label: "Keamanan akun", to: "/akun/keamanan" },
      {
        children: settingsItems,
        icon: SlidersHorizontal,
        label: "Pengaturan",
        roles: SUPERADMIN,
      },
    ],
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

const getModuleItems = (items: readonly NavigationItem[]): NavigationItem[] =>
  items.flatMap((item) => (item.children?.length ? item.children : [item]));

const isPathActive = (pathname: string, item: NavigationItem): boolean => {
  const activePaths = item.to
    ? [item.to, ...(item.activePaths ?? [])]
    : (item.activePaths ?? []);
  const itemIsActive = activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

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
  const [isOpen, setIsOpen] = useState(isActive);

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
      <Collapsible
        className="group/collapsible"
        onOpenChange={(open) => setIsOpen(open)}
        open={isOpen}
      >
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
          <SidebarMenu className="border-sidebar-border/50 mt-1 ml-3 max-w-[calc(100%_-_0.75rem)] gap-1 border-l pl-2">
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

const NavigationModule = ({
  items,
  label,
  pathname,
  setOpenMobile,
  sidebarState,
}: NavigationModuleProps) => {
  const isActive = items.some((item) => isPathActive(pathname, item));
  const [isOpen, setIsOpen] = useState(isActive);

  return (
    <Collapsible
      className="group/module"
      onOpenChange={(open) => setIsOpen(open)}
      open={sidebarState === "collapsed" || isOpen}
    >
      <CollapsibleTrigger className="text-sidebar-foreground/55 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-left text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors outline-none group-data-[collapsible=icon]:hidden focus-visible:ring-2">
        <span className="truncate">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className="ml-auto size-3.5 transition-transform duration-200 group-data-[open]/module:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <NavigationNode
                item={item}
                key={`${item.label}-${isPathActive(pathname, item)}`}
                pathname={pathname}
                setOpenMobile={setOpenMobile}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </CollapsibleContent>
    </Collapsible>
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
          aria-label="SIAKAD ITBKM MUNA BARAT"
          className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center"
          to="/dashboard"
        >
          <img
            alt=""
            className="size-10 shrink-0 rounded-sm object-cover shadow-sm"
            src="/logo-itbkm.webp"
          />
          <span className="truncate text-sm font-bold tracking-wide text-white group-data-[collapsible=icon]:hidden">
            SIAKAD ITBKM MUNA BARAT
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-4">
        {navigationSections.map((section) => {
          const visibleItems = getVisibleItems(section.items, roles);
          if (!visibleItems.length) {
            return null;
          }

          const moduleItems = section.label
            ? getModuleItems(visibleItems)
            : visibleItems;
          const sectionIsActive = visibleItems.some((item) =>
            isPathActive(pathname, item)
          );

          return (
            <SidebarGroup
              key={
                section.id ??
                (section.label
                  ? `${section.label}-${sectionIsActive}`
                  : "primary")
              }
            >
              {section.label ? (
                <NavigationModule
                  items={moduleItems}
                  label={section.label}
                  pathname={pathname}
                  setOpenMobile={setOpenMobile}
                  sidebarState={state}
                />
              ) : (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => (
                      <NavigationNode
                        item={item}
                        key={`${item.label}-${isPathActive(pathname, item)}`}
                        pathname={pathname}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
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

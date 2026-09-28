import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@siakad-itbkmmubar/ui/components/sheet";
import { cn } from "@siakad-itbkmmubar/ui/lib/utils";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

interface SidebarContextValue {
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  state: "collapsed" | "expanded";
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const useMediaQuery = (query: string) => {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    [query]
  );
  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );
  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

const SidebarProvider = ({
  children,
  className,
  defaultOpen = true,
  style,
  ...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) => {
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const state: SidebarContextValue["state"] = open ? "expanded" : "collapsed";
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((current) => !current);
      return;
    }
    setOpen((current) => !current);
  }, [isMobile]);
  const contextValue = React.useMemo(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state,
      toggleSidebar,
    }),
    [isMobile, open, openMobile, state, toggleSidebar]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className={cn(
          "group/sidebar-wrapper bg-background flex min-h-svh w-full",
          className
        )}
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "17rem",
            "--sidebar-width-icon": "3rem",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

const useSidebar = () => {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
};

const Sidebar = ({
  children,
  className,
  collapsible = "offcanvas",
  side = "left",
  variant = "sidebar",
  ...props
}: React.ComponentProps<"div"> & {
  collapsible?: "offcanvas" | "icon" | "none";
  side?: "left" | "right";
  variant?: "inset" | "floating" | "sidebar";
}) => {
  const { isMobile, openMobile, setOpenMobile, state } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) shrink-0 flex-col",
          className
        )}
        data-slot="sidebar"
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) rounded-r-3xl border-0 p-0 [&>button]:hidden"
          data-mobile="true"
          side={side}
          showCloseButton={false}
          style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu navigasi</SheetTitle>
            <SheetDescription>Menu utama aplikasi SIAKAD.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-slot="sidebar"
      data-state={state}
      data-variant={variant}
    >
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          state === "collapsed" && collapsible === "icon"
            ? "w-(--sidebar-width-icon)"
            : ""
        )}
        data-slot="sidebar-gap"
      />
      <div
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" && "p-2",
          className
        )}
        data-slot="sidebar-container"
        {...props}
      >
        <div
          className={cn(
            "bg-sidebar flex size-full flex-col shadow-[12px_0_32px_-28px_rgba(8,38,67,0.5)]",
            variant === "floating" && "rounded-2xl shadow-lg"
          )}
          data-slot="sidebar-inner"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const SidebarTrigger = ({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) => {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      aria-label="Buka menu navigasi"
      className={cn("rounded-xl", className)}
      data-slot="sidebar-trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      variant="ghost"
      {...props}
    >
      <PanelLeft aria-hidden="true" />
    </Button>
  );
};

const SidebarHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn("flex flex-col gap-2 p-5", className)}
    data-slot="sidebar-header"
    {...props}
  />
);

const SidebarContent = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-3",
      className
    )}
    data-slot="sidebar-content"
    {...props}
  />
);

const SidebarFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn("flex flex-col gap-2 p-4", className)}
    data-slot="sidebar-footer"
    {...props}
  />
);

const SidebarGroup = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn("relative flex w-full min-w-0 flex-col", className)}
    data-slot="sidebar-group"
    {...props}
  />
);

const SidebarGroupLabel = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "text-sidebar-foreground/55 flex h-8 shrink-0 items-center px-3 text-[10px] font-semibold tracking-[0.18em] uppercase",
      className
    )}
    data-slot="sidebar-group-label"
    {...props}
  />
);

const SidebarGroupContent = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn("w-full text-sm", className)}
    data-slot="sidebar-group-content"
    {...props}
  />
);

const SidebarMenu = ({ className, ...props }: React.ComponentProps<"ul">) => (
  <ul
    className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}
    data-slot="sidebar-menu"
    {...props}
  />
);

const SidebarMenuItem = ({
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    className={cn("group/menu-item relative", className)}
    data-slot="sidebar-menu-item"
    {...props}
  />
);

const sidebarMenuButtonVariants = cva(
  "group/menu-button text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground flex h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 data-active:font-semibold [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    defaultVariants: { size: "default" },
    variants: {
      size: {
        default: "h-11",
        lg: "h-12",
        sm: "h-9 text-xs",
      },
    },
  }
);

const SidebarMenuButton = ({
  className,
  isActive = false,
  render,
  size = "default",
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean;
  } & VariantProps<typeof sidebarMenuButtonVariants>) =>
  useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ className, size })),
      },
      props
    ),
    render,
    state: {
      active: isActive,
      sidebar: "menu-button",
      size,
      slot: "sidebar-menu-button",
    },
  });

const SidebarInset = ({
  className,
  ...props
}: React.ComponentProps<"main">) => (
  <main
    className={cn(
      "bg-background relative flex min-w-0 flex-1 flex-col",
      className
    )}
    data-slot="sidebar-inset"
    {...props}
  />
);

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};

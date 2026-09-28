import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";

interface NotificationCenterProps {
  children?: ReactNode;
  unreadCount?: number;
}

export const NotificationCenter = ({
  children,
  unreadCount = 0,
}: NotificationCenterProps) => (
  <details className="relative">
    <summary className="list-none">
      <Button
        aria-label={`Notifikasi, ${unreadCount} belum dibaca`}
        size="icon"
        variant="ghost"
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-xs leading-4">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
    </summary>
    <div className="border-border bg-popover text-popover-foreground absolute right-0 z-30 mt-2 w-72 border p-3 shadow-lg">
      <p className="text-sm font-medium">Notifikasi</p>
      <div className="mt-3">
        {children ?? (
          <p className="text-muted-foreground text-xs">Belum ada notifikasi.</p>
        )}
      </div>
    </div>
  </details>
);

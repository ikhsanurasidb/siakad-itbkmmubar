import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@siakad-itbkmmubar/ui/components/dropdown-menu";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";

export interface NotificationItem {
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  route: string | null;
  status: "READ" | "UNREAD";
  title: string;
  type: string;
}

const EMPTY_NOTIFICATIONS: readonly NotificationItem[] = [];

interface NotificationCenterProps {
  hasError?: boolean;
  isLoading?: boolean;
  isMarkingAllRead?: boolean;
  notifications?: readonly NotificationItem[];
  onMarkAllRead?: () => void | Promise<void>;
  onNotificationClick?: (
    notification: NotificationItem
  ) => void | Promise<void>;
  onRetry?: () => void;
  unreadCount?: number;
}

type NotificationContentProps = Pick<
  NotificationCenterProps,
  "hasError" | "isLoading" | "notifications" | "onNotificationClick" | "onRetry"
>;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const formatNotificationDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
};

const NotificationContent = ({
  hasError = false,
  isLoading = false,
  notifications = EMPTY_NOTIFICATIONS,
  onNotificationClick,
  onRetry,
}: NotificationContentProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[#71859c]">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        Memuat notifikasi...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-8 text-center">
        <p className="text-xs text-[#71859c]">Notifikasi belum dapat dimuat.</p>
        {onRetry && (
          <Button
            className="h-8 rounded-lg px-3 text-xs"
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Coba lagi
          </Button>
        )}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-[#71859c]">
        Belum ada notifikasi.
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto py-1">
      {notifications.map((notification) => (
        <DropdownMenuItem
          className="block rounded-none border-b border-[#edf2f6] px-4 py-3 last:border-b-0 focus:bg-[#f5f9fc]"
          key={notification.id}
          onClick={() => onNotificationClick?.(notification)}
        >
          <div className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                notification.status === "UNREAD"
                  ? "bg-[#1d78d4]"
                  : "bg-transparent"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm leading-5 ${
                  notification.status === "UNREAD"
                    ? "font-semibold text-[#102d4d]"
                    : "font-medium text-[#536b83]"
                }`}
              >
                {notification.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#71859c]">
                {notification.body}
              </span>
              <span className="mt-1.5 block text-[11px] text-[#9aabba]">
                {formatNotificationDate(notification.createdAt)}
              </span>
            </span>
          </div>
        </DropdownMenuItem>
      ))}
    </div>
  );
};

export const NotificationCenter = ({
  hasError = false,
  isLoading = false,
  isMarkingAllRead = false,
  notifications = EMPTY_NOTIFICATIONS,
  onMarkAllRead,
  onNotificationClick,
  onRetry,
  unreadCount = 0,
}: NotificationCenterProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={`Notifikasi, ${unreadCount} belum dibaca`}
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors outline-none hover:bg-slate-100 hover:text-[#12395c] focus-visible:ring-2 focus-visible:ring-[#1d78d4]/30"
    >
      <Bell aria-hidden="true" className="size-5" />
      {unreadCount > 0 && (
        <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-xs leading-4">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border-[#dbe5ee] p-0"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#e7edf3] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#102d4d]">Notifikasi</p>
          <p className="mt-0.5 text-xs text-[#71859c]">
            {unreadCount > 0
              ? `${unreadCount} belum dibaca`
              : "Semua sudah dibaca"}
          </p>
        </div>
        {unreadCount > 0 && onMarkAllRead && (
          <DropdownMenuItem
            className="h-auto rounded-lg px-2 py-1.5 text-xs text-[#0b559c] focus:bg-[#eef4f9]"
            disabled={isMarkingAllRead}
            onClick={onMarkAllRead}
          >
            <CheckCheck aria-hidden="true" className="size-3.5" />
            Tandai dibaca
          </DropdownMenuItem>
        )}
      </div>

      <NotificationContent
        hasError={hasError}
        isLoading={isLoading}
        notifications={notifications}
        onNotificationClick={onNotificationClick}
        onRetry={onRetry}
      />
    </DropdownMenuContent>
  </DropdownMenu>
);

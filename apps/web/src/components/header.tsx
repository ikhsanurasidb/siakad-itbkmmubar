import { Button } from "@siakad-itbkmmubar/ui/components/button";
import { NotificationCenter } from "@siakad-itbkmmubar/ui/components/notification-center";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

const Header = () => (
  <header className="border-border bg-background sticky top-0 z-20 border-b">
    <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-4 px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          aria-label="Buka menu navigasi"
          className="lg:hidden"
          size="icon"
          variant="ghost"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Link className="flex items-center gap-2" to="/">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center text-sm font-semibold">
            S
          </span>
          <span className="hidden text-sm font-semibold sm:inline">
            SIAKAD ITB KMMU BAR
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <NotificationCenter />
        <Button className="hidden sm:inline-flex" size="sm" variant="outline">
          Masuk
        </Button>
      </div>
    </div>
  </header>
);

export default Header;

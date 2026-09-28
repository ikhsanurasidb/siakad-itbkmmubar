import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  href?: string;
  id?: string;
  label: string;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
}

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => (
  <nav aria-label="Jejak navigasi">
    <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
      {items.map((item, index) => (
        <li
          className="flex items-center gap-1"
          key={item.id ?? item.href ?? item.label}
        >
          {index > 0 && <ChevronRight aria-hidden="true" className="size-3" />}
          {item.href ? (
            <a
              className="hover:text-foreground hover:underline"
              href={item.href}
            >
              {item.label}
            </a>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export type { BreadcrumbItem };

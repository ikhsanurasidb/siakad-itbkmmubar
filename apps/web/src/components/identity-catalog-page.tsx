import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import type { ReactNode } from "react";

interface IdentityCatalogPageProps {
  cardDescription: string;
  cardTitle: string;
  children: ReactNode;
  description: string;
  title: string;
}

const IdentityCatalogPage = ({
  cardDescription,
  cardTitle,
  children,
  description,
  title,
}: IdentityCatalogPageProps) => (
  <div className="mx-auto grid w-full max-w-screen-2xl gap-6 p-4 lg:p-6">
    <div className="grid gap-2">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        Identitas dan akses
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
        <CardDescription>{cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  </div>
);

export default IdentityCatalogPage;

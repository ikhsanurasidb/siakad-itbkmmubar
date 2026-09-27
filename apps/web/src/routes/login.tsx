import { Button } from "@siakad-itbkmmubar/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@siakad-itbkmmubar/ui/components/card";
import { Input } from "@siakad-itbkmmubar/ui/components/input";
import { Label } from "@siakad-itbkmmubar/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const RouteComponent = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="grid min-h-[calc(100svh-3.5rem)] place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Masuk ke sistem</CardTitle>
          <CardDescription>
            Gunakan identifier resmi dan kata sandi Anda untuk melanjutkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="grid gap-2">
              <Label htmlFor="identifier">Identifier</Label>
              <Input
                autoComplete="username"
                id="identifier"
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Contoh: NIM atau DSN..."
                value={identifier}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Kata sandi</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            <Button disabled={!identifier || !password} type="submit">
              Masuk
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

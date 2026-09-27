import { Toaster } from "@siakad-itbkmmubar/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const RootComponent = () => (
  <>
    <HeadContent />
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <div className="grid min-h-svh grid-rows-[auto_1fr]">
        <a className="sr-only focus:not-sr-only" href="#main-content">
          Lewati ke konten utama
        </a>
        <Header />
        <div className="flex min-h-0">
          <Sidebar />
          <main className="min-w-0 flex-1" id="main-content">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster richColors />
    </ThemeProvider>
    <TanStackRouterDevtools position="bottom-left" />
    <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
  </>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "siakad-itbkmmubar",
      },
      {
        name: "description",
        content: "siakad-itbkmmubar is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

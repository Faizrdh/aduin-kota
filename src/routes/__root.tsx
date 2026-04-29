/* eslint-disable */
// src/routes/__root.tsx

import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect }  from "react";
import { Sidebar, MobileTopbar } from "@/components/civic/Sidebar";
import { refreshSession, AuthUser } from "@/data/login";
import { resetIdleTimer }           from "@/lib/apiFetch";
import appCss from "../styles.css?url";

// ─── QueryClient global ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:              2,
      staleTime:          30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Event yang dianggap aktivitas user ───────────────────────────────────────
const ACTIVITY_EVENTS = [
  "mousedown", "mousemove", "keydown",
  "touchstart", "wheel", "scroll", "click",
] as const;

// ─── 404 ──────────────────────────────────────────────────────────────────────
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Halaman Tidak Ditemukan
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AduinKota — Pengaduan Warga Indonesia" },
      { name: "description", content: "Platform pengaduan warga untuk kota yang lebih baik." },
      { name: "author", content: "AduinKota" },
      { property: "og:title",       content: "AduinKota — Pengaduan Warga Indonesia" },
      { property: "og:description", content: "Real-time civic engagement platform for Indonesian cities." },
      { property: "og:type",        content: "website" },
      { name: "twitter:card",       content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component:      RootComponent,
  notFoundComponent: NotFoundComponent,
});

// ─── Shell HTML ───────────────────────────────────────────────────────────────
function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// ─── Routes tanpa sidebar ─────────────────────────────────────────────────────
const SHELL_FREE_ROUTES = ["/landing", "/login"];

// ─── Root Component ───────────────────────────────────────────────────────────
function RootComponent() {
  const { location }          = useRouterState();
  const navigate              = useNavigate();
  const [initialized, setInitialized] = useState(false);
  const isShellFree = SHELL_FREE_ROUTES.includes(location.pathname);

  // ── 1. Restore sesi saat app pertama load ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await refreshSession();
      if (cancelled) return;

      setInitialized(true);

      // Kalau tidak ada sesi & bukan di halaman bebas → redirect login
      if (!user && !SHELL_FREE_ROUTES.includes(location.pathname)) {
        navigate({ to: "/login" });
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Idle tracker — reset timer setiap ada aktivitas user ───────────────
  useEffect(() => {
    if (!initialized) return;

    const handleActivity = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true })
    );
    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity)
      );
    };
  }, [initialized]);

  // ── Loading sementara sesi direstorasi ────────────────────────────────────
  if (!initialized && !isShellFree) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-indigo-500 animate-spin" />
          <span className="text-xs text-muted-foreground">Memuat sesi…</span>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {isShellFree ? (
        <Outlet />
      ) : (
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 md:pl-64">
            <MobileTopbar />
            <Outlet />
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}
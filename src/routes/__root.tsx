import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import obhLogo from "@/assets/obh-logo.png";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้าที่ต้องการ</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-muted-foreground">เกิดข้อผิดพลาด ลองใหม่อีกครั้ง</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ลองอีกครั้ง
          </button>
          <a href="/" className="rounded-xl border bg-card px-4 py-2 text-sm font-medium">
            หน้าแรก
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ระบบอบรมออนไลน์ โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "ระบบฝึกอบรมออนไลน์สำหรับบุคลากรโรงพยาบาล" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "shortcut icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var s = localStorage.getItem("hospital_font_size") || "normal";
                document.documentElement.setAttribute("data-font-size", s);

                var m = localStorage.getItem("hospital_theme_mode") || "light";
                var isDark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                if (isDark) {
                  document.documentElement.classList.add("dark");
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.classList.remove("dark");
                  document.documentElement.setAttribute("data-theme", "light");
                }

                var c = localStorage.getItem("hospital_color_theme") || "blue";
                document.documentElement.setAttribute("data-color-theme", c);
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function FaviconSync() {
  const { data: profile } = useQuery({
    queryKey: ["hospital-profile-brand"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "hospital_profile")
        .maybeSingle();
      return (data?.value ?? null) as { logo_url?: string } | null;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    let active = true;
    async function syncFavicon() {
      let href = obhLogo || "/favicon.png";
      if (profile?.logo_url) {
        const resolved = await fileUrl(profile.logo_url);
        if (resolved) href = resolved;
      }
      if (!active || typeof document === "undefined") return;
      const icons = document.querySelectorAll<HTMLLinkElement>(
        "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
      );
      icons.forEach((link) => {
        link.href = href;
      });
    }
    syncFavicon();
    return () => {
      active = false;
    };
  }, [profile?.logo_url]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // After an update, a browser tab still holding the old bundle can fail to load
  // renamed chunks ("Importing a module script failed") — reload once to pick up
  // the fresh deployment instead of showing a blank screen.
  useEffect(() => {
    const onChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const msg = event instanceof ErrorEvent ? event.message : String((event as PromiseRejectionEvent).reason);
      if (!/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) return;
      const key = "chunk-reload-at";
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    };
    window.addEventListener("error", onChunkError);
    window.addEventListener("unhandledrejection", onChunkError);
    return () => {
      window.removeEventListener("error", onChunkError);
      window.removeEventListener("unhandledrejection", onChunkError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FaviconSync />
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

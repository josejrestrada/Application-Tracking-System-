"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useAtsStore } from "@/store/ats-store";

const NAV = [
  { href: "/dashboard", label: "Command" },
  { href: "/jobs", label: "Requisitions" },
  { href: "/candidates", label: "Pipeline" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const signOut = useAuthStore((s) => s.signOut);
  const refresh = useAtsStore((s) => s.refresh);
  const atsHydrated = useAtsStore((s) => s.hydrated);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (!hydrated || !user || !atsHydrated) {
    return (
      <div className="grid min-h-screen place-items-center text-[#3d5168]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#d9d0c0] bg-[#f3efe6]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="leading-tight">
              <span className="block text-[11px] tracking-[0.18em] uppercase text-[#0f6e67]">
                Meridian
              </span>
              <span style={{ fontFamily: "var(--font-display)" }} className="text-lg">
                ATS
              </span>
            </Link>
            <nav className="flex gap-1">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      active ? "bg-[#12243a] text-white" : "text-[#3d5168]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[#3d5168]">
                {user.role.replace(/_/g, " ")} · {user.hub}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
              className="rounded-full border border-[#d9d0c0] px-3 py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}

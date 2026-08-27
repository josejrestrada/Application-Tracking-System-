"use client";

import { AppShell } from "@/components/layout/app-shell";

export default function CandidateDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

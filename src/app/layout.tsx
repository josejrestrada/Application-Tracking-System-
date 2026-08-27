import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meridian ATS",
  description: "Applicant tracking for Meridian Technologies staffing operations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider
          telemetry={false}
          signInUrl="/login"
          signUpUrl="/sign-up"
          afterSignOutUrl="/login"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

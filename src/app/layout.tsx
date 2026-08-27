import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meridian ATS",
  description: "Applicant tracking for Meridian Technologies staffing operations.",
};

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "pk_test_Y2xlcmsuYnVpbGQtcGxhY2Vob2xkZXI";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider
          publishableKey={clerkPublishableKey}
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

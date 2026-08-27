"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");

  return (
    <main className="min-h-screen bg-[#12243a] text-[#f3efe6]">
      <div className="mx-auto grid min-h-screen max-w-6xl md:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between p-8 md:p-14">
          <p className="text-sm tracking-[0.2em] uppercase text-[#9fb4a8]">
            Meridian Technologies
          </p>
          <div>
            <h1 className="max-w-xl text-4xl leading-tight md:text-5xl">
              Staffing operations for project delivery, not a generic HR inbox.
            </h1>
            <p className="mt-5 max-w-lg text-[#c9d4cc]">
              Sign in with Google or email. Recruiter collision checks and
              pipeline tracking stay behind your Clerk account.
            </p>
          </div>
          <p className="text-sm text-[#8aa094]">Pune · Bangalore · Goa</p>
        </section>

        <section className="flex items-center bg-[#f3efe6] p-8 text-[#12243a] md:p-12">
          <div className="w-full max-w-md">
            <div className="mb-6 flex gap-2 rounded-full bg-[#e7e0d3] p-1 text-sm">
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 ${mode === "in" ? "bg-white" : ""}`}
                onClick={() => setMode("in")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 ${mode === "up" ? "bg-white" : ""}`}
                onClick={() => setMode("up")}
              >
                Sign up
              </button>
            </div>

            {mode === "in" ? (
              <SignIn
                routing="hash"
                forceRedirectUrl="/candidates"
                signUpUrl="#signup"
                appearance={{
                  variables: { colorPrimary: "#0f6e67" },
                  layout: { socialButtonsVariant: "blockButton" },
                }}
              />
            ) : (
              <SignUp
                routing="hash"
                forceRedirectUrl="/candidates"
                signInUrl="#signin"
                appearance={{
                  variables: { colorPrimary: "#0f6e67" },
                  layout: { socialButtonsVariant: "blockButton" },
                }}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/data/seed";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "");
    const name = String(data.get("name") || "");
    const password = String(data.get("password") || "demo");
    const result =
      mode === "in"
        ? await signIn(email, password)
        : await signUp(name, email, password);
    if (!result.ok) {
      setError(result.error || "Unable to continue.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#12243a] text-[#f3efe6]">
      <div className="mx-auto grid min-h-screen max-w-6xl md:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between p-8 md:p-14">
          <p className="text-sm tracking-[0.2em] uppercase text-[#9fb4a8]">
            Meridian Technologies
          </p>
          <div>
            <h1
              className="max-w-xl text-4xl leading-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Staffing operations for project delivery, not a generic HR inbox.
            </h1>
            <p className="mt-5 max-w-lg text-[#c9d4cc]">
              Track client billing, notice-period risk, and a strict hiring
              pipeline from Applied through BGV and joining.
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

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "up" && (
                <label className="block text-sm">
                  Full name
                  <input
                    name="name"
                    required
                    className="mt-1 w-full rounded-lg border border-[#d9d0c0] bg-white px-3 py-2"
                  />
                </label>
              )}
              <label className="block text-sm">
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="rahul@meridian.tech"
                  className="mt-1 w-full rounded-lg border border-[#d9d0c0] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Password
                <input
                  name="password"
                  type="password"
                  defaultValue="demo"
                  className="mt-1 w-full rounded-lg border border-[#d9d0c0] bg-white px-3 py-2"
                />
              </label>
              {error && <p className="text-sm text-[#9f1239]">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-[#0f6e67] px-4 py-2.5 text-white"
              >
                Continue
              </button>
            </form>

            <div className="mt-8 border-t border-[#d9d0c0] pt-4 text-sm">
              <p className="mb-2 text-[#3d5168]">Demo accounts</p>
              <ul className="space-y-1">
                {DEMO_USERS.map((u) => (
                  <li key={u.id}>
                    {u.name} · {u.email}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type AuthState = {
  user: SessionUser | null;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  bootstrap: async () => {
    try {
      const data = await api.get<{ user: SessionUser }>("/api/auth/me");
      set({ user: data.user, hydrated: true });
    } catch {
      set({ user: null, hydrated: true });
    }
  },
  signIn: async (email, password) => {
    try {
      const data = await api.post<{ user: SessionUser }>("/api/auth/login", {
        email,
        password,
      });
      set({ user: data.user, hydrated: true });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unable to sign in.",
      };
    }
  },
  signUp: async (name, email, password) => {
    try {
      const data = await api.post<{ user: SessionUser }>("/api/auth/signup", {
        name,
        email,
        password,
      });
      set({ user: data.user, hydrated: true });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unable to sign up.",
      };
    }
  },
  signOut: async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    set({ user: null });
  },
}));

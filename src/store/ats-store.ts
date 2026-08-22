"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  Candidate,
  ClientApprovalStatus,
  JobRequisition,
  RejectReasonCode,
  StageEvent,
} from "@/lib/types";

type AtsState = {
  jobs: JobRequisition[];
  candidates: Candidate[];
  events: StageEvent[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addJob: (job: Omit<JobRequisition, "id" | "createdAt">) => Promise<string>;
  addCandidate: (
    candidate: Omit<Candidate, "id" | "createdAt" | "updatedAt" | "clientApprovalStatus">
  ) => Promise<string>;
  advanceCandidate: (id: string) => Promise<{ ok: boolean; error?: string }>;
  setClientApproval: (
    id: string,
    status: ClientApprovalStatus
  ) => Promise<{ ok: boolean; error?: string }>;
  exitPipeline: (
    id: string,
    toStage: "rejected" | "dropped_out",
    reason: RejectReasonCode,
    notes: string
  ) => Promise<void>;
};

export const useAtsStore = create<AtsState>((set, get) => ({
  jobs: [],
  candidates: [],
  events: [],
  hydrated: false,
  refresh: async () => {
    const data = await api.get<{
      jobs: JobRequisition[];
      candidates: Candidate[];
      events: StageEvent[];
    }>("/api/workspace");
    set({
      jobs: data.jobs,
      candidates: data.candidates,
      events: data.events,
      hydrated: true,
    });
  },
  addJob: async (job) => {
    const data = await api.post<{ job: JobRequisition }>("/api/jobs", job);
    await get().refresh();
    return data.job.id;
  },
  addCandidate: async (candidate) => {
    const data = await api.post<{ candidate: Candidate }>("/api/candidates", candidate);
    await get().refresh();
    return data.candidate.id;
  },
  advanceCandidate: async (id) => {
    try {
      await api.post(`/api/candidates/${id}/advance`);
      await get().refresh();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unable to advance.",
      };
    }
  },
  setClientApproval: async (id, status) => {
    try {
      await api.post(`/api/candidates/${id}/client-approval`, { status });
      await get().refresh();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unable to update approval.",
      };
    }
  },
  exitPipeline: async (id, toStage, reason, notes) => {
    await api.post(`/api/candidates/${id}/exit`, { toStage, reason, notes });
    await get().refresh();
  },
}));

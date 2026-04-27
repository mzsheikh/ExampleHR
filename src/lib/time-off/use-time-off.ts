"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchBalance,
  fetchBatchBalances,
  fetchRequests,
  postDecision,
  postTimeOffRequest,
  triggerBonus
} from "./client-api";
import { CURRENT_EMPLOYEE_ID } from "./sample-data";
import { optimisticBalance } from "./reconciliation";
import type { BalanceCell, HcmMode, LocationId, RequestFormState, TimeOffRequest } from "./types";

type Toast = {
  tone: "info" | "success" | "warning" | "danger";
  message: string;
};

export type TimeOffState = {
  balances: BalanceCell[];
  requests: TimeOffRequest[];
  selectedLocationId: LocationId;
  status: "loading" | "ready" | "refreshing" | "error";
  toast?: Toast;
  lastBatchSyncedAt?: string;
  optimisticRequestId?: string;
};

const defaultForm: RequestFormState = {
  locationId: "nyc",
  days: 1,
  startsOn: "2026-05-04",
  endsOn: "2026-05-04",
  reason: "Personal time"
};

export function useTimeOffDashboard() {
  const [state, setState] = useState<TimeOffState>({
    balances: [],
    requests: [],
    selectedLocationId: "nyc",
    status: "loading"
  });
  const [form, setForm] = useState<RequestFormState>(defaultForm);
  const [mode, setMode] = useState<HcmMode>("normal");
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async (tone: Toast["tone"] = "info") => {
    setState((current) => ({ ...current, status: current.status === "loading" ? "loading" : "refreshing" }));
    try {
      const [balances, requests] = await Promise.all([fetchBatchBalances(), fetchRequests()]);
      setState((current) => ({
        ...current,
        balances: balances.data,
        requests: requests.data,
        status: "ready",
        lastBatchSyncedAt: new Date().toISOString(),
        toast: {
          tone,
          message: balances.warnings?.[0] ?? "Balances reconciled with HCM."
        }
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        toast: { tone: "danger", message: error instanceof Error ? error.message : "Unable to reach HCM." }
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh("info"), 45_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const selectedBalance = useMemo(
    () =>
      state.balances.find(
        (balance) => balance.employeeId === CURRENT_EMPLOYEE_ID && balance.locationId === state.selectedLocationId
      ),
    [state.balances, state.selectedLocationId]
  );

  const updateBalance = useCallback((balance: BalanceCell) => {
    setState((current) => ({
      ...current,
      balances: current.balances.map((candidate) =>
        candidate.employeeId === balance.employeeId && candidate.locationId === balance.locationId ? balance : candidate
      )
    }));
  }, []);

  const selectLocation = useCallback((locationId: LocationId) => {
    setState((current) => ({ ...current, selectedLocationId: locationId }));
    setForm((current) => ({ ...current, locationId }));
  }, []);

  const submitRequest = useCallback(() => {
    if (!selectedBalance) {
      return;
    }

    const optimistic = optimisticBalance(selectedBalance, form.days);
    updateBalance(optimistic);
    setState((current) => ({
      ...current,
      optimisticRequestId: "local-pending",
      toast: { tone: "info", message: "Request held as pending while HCM verifies the exact balance cell." }
    }));

    startTransition(async () => {
      try {
        const result = await postTimeOffRequest({
          employeeId: CURRENT_EMPLOYEE_ID,
          locationId: form.locationId,
          days: form.days,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
          reason: form.reason,
          mode
        });

        updateBalance(result.data.balance);
        setState((current) => ({
          ...current,
          requests: [result.data.request, ...current.requests.filter((request) => request.id !== result.data.request.id)],
          optimisticRequestId: undefined,
          toast: result.warnings?.length
            ? { tone: "warning", message: result.warnings[0] }
            : { tone: "success", message: "Request submitted as pending. HCM remains the approval authority." }
        }));
      } catch (error) {
        updateBalance(selectedBalance);
        setState((current) => ({
          ...current,
          optimisticRequestId: undefined,
          toast: {
            tone: "danger",
            message: error instanceof Error ? `HCM rejected the request: ${error.message}` : "HCM rejected the request."
          }
        }));
      }
    });
  }, [form, mode, selectedBalance, updateBalance]);

  const decide = useCallback((requestId: string, decision: "approve" | "deny", decisionMode: HcmMode = "normal") => {
    startTransition(async () => {
      try {
        const result = await postDecision({ requestId, managerId: "mgr-3001", decision, mode: decisionMode });
        updateBalance(result.data.balance);
        setState((current) => ({
          ...current,
          requests: current.requests.map((request) =>
            request.id === result.data.request.id ? result.data.request : request
          ),
          toast: {
            tone: decision === "approve" ? "success" : "info",
            message:
              decision === "approve"
                ? "Approved after real-time HCM verification."
                : "Denied and pending balance released."
          }
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          toast: {
            tone: "warning",
            message:
              error instanceof Error
                ? `Decision paused for review: ${error.message}`
                : "Decision paused for HCM review."
          }
        }));
        void refresh("warning");
      }
    });
  }, [refresh, updateBalance]);

  const applyBonus = useCallback(() => {
    startTransition(async () => {
      const result = await triggerBonus(CURRENT_EMPLOYEE_ID);
      setState((current) => ({
        ...current,
        balances: current.balances.map((balance) => {
          const replacement = result.data.find(
            (candidate) => candidate.employeeId === balance.employeeId && candidate.locationId === balance.locationId
          );
          return replacement ?? balance;
        }),
        toast: {
          tone: "warning",
          message: "HCM changed balances mid-session. The visible rows were reconciled without changing request status."
        }
      }));
    });
  }, []);

  return {
    state,
    form,
    mode,
    isPending,
    selectedBalance,
    setForm,
    setMode,
    selectLocation,
    submitRequest,
    decide,
    refresh,
    applyBonus,
    verifySelectedCell: selectedBalance
      ? () => fetchBalance(CURRENT_EMPLOYEE_ID, selectedBalance.locationId, mode).then((result) => updateBalance(result.data))
      : undefined
  };
}

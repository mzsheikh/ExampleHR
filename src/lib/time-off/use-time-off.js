"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchBalance, fetchBatchBalances, fetchRequests, postDecision, postTimeOffRequest, triggerBonus } from "./client-api";
import { CURRENT_EMPLOYEE_ID } from "./sample-data";
import { optimisticBalance } from "./reconciliation";
import { useTimeOffUiStore } from "./ui-store";

const EMPTY_ARRAY = [];

export function useTimeOffDashboard() {
    const queryClient = useQueryClient();
    const {
        selectedLocationId,
        form,
        mode,
        toast,
        optimisticRequestId,
        selectLocation,
        setForm,
        setMode,
        setToast,
        setOptimisticRequestId
    } = useTimeOffUiStore();
    const balancesQuery = useQuery({
        queryKey: ["balances"],
        queryFn: fetchBatchBalances,
        refetchInterval: 10_000
    });
    const requestsQuery = useQuery({
        queryKey: ["requests"],
        queryFn: () => fetchRequests(),
        refetchInterval: 5_000
    });
    const balances = balancesQuery.data?.data ?? EMPTY_ARRAY;
    const requests = requestsQuery.data?.data ?? EMPTY_ARRAY;
    const selectedBalance = useMemo(() => balances.find((balance) => balance.employeeId === CURRENT_EMPLOYEE_ID && balance.locationId === selectedLocationId), [balances, selectedLocationId]);
    const updateBalanceCache = (balance) => {
        queryClient.setQueryData(["balances"], (current) => {
            if (!current?.data) {
                return current;
            }
            return {
                ...current,
                data: current.data.map((candidate) => candidate.employeeId === balance.employeeId && candidate.locationId === balance.locationId ? balance : candidate)
            };
        });
    };
    const submitMutation = useMutation({
        mutationFn: postTimeOffRequest,
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: ["balances"] });
            const previousBalances = queryClient.getQueryData(["balances"]);
            if (selectedBalance) {
                updateBalanceCache(optimisticBalance(selectedBalance, input.days));
            }
            setOptimisticRequestId("local-pending");
            setToast({ tone: "info", message: "Request held as pending while HCM verifies the exact balance cell." });
            return { previousBalances };
        },
        onSuccess: (result) => {
            updateBalanceCache(result.data.balance);
            queryClient.setQueryData(["requests"], (current) => ({
                data: [result.data.request, ...(current?.data ?? []).filter((request) => request.id !== result.data.request.id)]
            }));
            setOptimisticRequestId(undefined);
            setToast(result.warnings?.length
                ? { tone: "warning", message: result.warnings[0] }
                : { tone: "success", message: "Request submitted as pending. HCM remains the approval authority." });
        },
        onError: (error, _input, context) => {
            if (context?.previousBalances) {
                queryClient.setQueryData(["balances"], context.previousBalances);
            }
            setOptimisticRequestId(undefined);
            setToast({
                tone: "danger",
                message: error instanceof Error ? `HCM rejected the request: ${error.message}` : "HCM rejected the request."
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["balances"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });
    const decisionMutation = useMutation({
        mutationFn: postDecision,
        onSuccess: (result, input) => {
            updateBalanceCache(result.data.balance);
            queryClient.setQueryData(["requests"], (current) => ({
                data: (current?.data ?? []).map((request) => request.id === result.data.request.id ? result.data.request : request)
            }));
            setToast({
                tone: input.decision === "approve" ? "success" : "info",
                message: input.decision === "approve"
                    ? "Approved after real-time HCM verification."
                    : "Denied and pending balance released."
            });
        },
        onError: (error) => {
            setToast({
                tone: "warning",
                message: error instanceof Error ? `Decision paused for review: ${error.message}` : "Decision paused for HCM review."
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["balances"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
        }
    });
    const bonusMutation = useMutation({
        mutationFn: () => triggerBonus(CURRENT_EMPLOYEE_ID),
        onSuccess: (result) => {
            queryClient.setQueryData(["balances"], (current) => ({
                ...current,
                data: (current?.data ?? []).map((balance) => {
                    const replacement = result.data.find((candidate) => candidate.employeeId === balance.employeeId && candidate.locationId === balance.locationId);
                    return replacement ?? balance;
                })
            }));
            setToast({
                tone: "warning",
                message: "HCM changed balances mid-session. The visible rows were reconciled without changing request status."
            });
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["balances"] })
    });
    const refresh = async (tone = "info") => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["balances"] }),
            queryClient.invalidateQueries({ queryKey: ["requests"] })
        ]);
        setToast({ tone, message: "Balances reconciled with HCM." });
    };
    const submitRequest = () => {
        if (!selectedBalance) {
            return;
        }
        submitMutation.mutate({
            employeeId: CURRENT_EMPLOYEE_ID,
            locationId: form.locationId,
            days: form.days,
            startsOn: form.startsOn,
            endsOn: form.endsOn,
            reason: form.reason,
            mode
        });
    };
    const decide = (requestId, decision, decisionMode = "normal") => {
        decisionMutation.mutate({ requestId, managerId: "mgr-3001", decision, mode: decisionMode });
    };
    return {
        state: {
            balances,
            requests,
            selectedLocationId,
            status: balancesQuery.isLoading || requestsQuery.isLoading ? "loading" : balancesQuery.isError || requestsQuery.isError ? "error" : balancesQuery.isFetching || requestsQuery.isFetching ? "refreshing" : "ready",
            toast,
            optimisticRequestId,
            lastBatchSyncedAt: balancesQuery.dataUpdatedAt ? new Date(balancesQuery.dataUpdatedAt).toISOString() : undefined
        },
        form,
        mode,
        isPending: submitMutation.isPending || decisionMutation.isPending || bonusMutation.isPending,
        selectedBalance,
        setForm,
        setMode,
        selectLocation,
        submitRequest,
        decide,
        refresh,
        applyBonus: () => bonusMutation.mutate(),
        verifySelectedCell: selectedBalance
            ? () => fetchBalance(CURRENT_EMPLOYEE_ID, selectedBalance.locationId, mode).then((result) => updateBalanceCache(result.data))
            : undefined
    };
}

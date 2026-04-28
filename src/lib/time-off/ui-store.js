"use client";

import { create } from "zustand";

const defaultForm = {
  locationId: "nyc",
  days: 1,
  startsOn: "2026-05-04",
  endsOn: "2026-05-04",
  reason: "Personal time"
};

export const useTimeOffUiStore = create((set) => ({
  selectedLocationId: "nyc",
  form: defaultForm,
  mode: "normal",
  toast: undefined,
  optimisticRequestId: undefined,
  selectLocation: (locationId) =>
    set((state) => ({
      selectedLocationId: locationId,
      form: { ...state.form, locationId }
    })),
  setForm: (form) => set({ form }),
  setMode: (mode) => set({ mode }),
  setToast: (toast) => set({ toast }),
  setOptimisticRequestId: (optimisticRequestId) => set({ optimisticRequestId })
}));

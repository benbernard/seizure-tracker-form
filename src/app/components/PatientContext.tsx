"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../actions";
import type { Settings } from "@/lib/aws/schema";

const PatientContext = createContext<string | undefined>(undefined);

export function PatientProvider({ children }: { children: ReactNode }) {
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const result = await getSettings();
      return result as Settings;
    },
  });

  return (
    <PatientContext.Provider value={settings?.currentPatientId}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientId() {
  const patientId = useContext(PatientContext);
  return patientId;
}

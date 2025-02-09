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
      console.log("BENBEN Settings result:", result);
      return result as Settings;
    },
  });

  console.log("BENBEN Current settings:", settings);
  console.log("BENBEN Current patientId:", settings?.currentPatientId);

  return (
    <PatientContext.Provider value={settings?.currentPatientId}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientId() {
  const patientId = useContext(PatientContext);
  console.log("BENBEN usePatientId called, value:", patientId);
  return patientId;
}

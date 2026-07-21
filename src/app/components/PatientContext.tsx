"use client";

import type { Settings } from "@/lib/aws/schema";
import { useAuth } from "@/lib/clerk-client";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";
import { getSettings } from "../actions";

const PatientContext = createContext<string | undefined>(undefined);

export function PatientProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const result = await getSettings();
      return result as Settings;
    },
    enabled: isSignedIn === true,
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

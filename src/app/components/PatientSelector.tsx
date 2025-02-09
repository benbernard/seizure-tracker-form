"use client";

import type { Patient, Settings } from "@/lib/aws/schema";
import { useEffect, useState } from "react";
import { getPatients, updateCurrentPatient } from "../actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export default function PatientSelector({ settings }: { settings: Settings }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const patientsList = await getPatients();
        setPatients(patientsList);
      } catch (error) {
        console.error("BENBEN: Error loading patients:", error);
        toast.error("Failed to load patients");
      } finally {
        setLoading(false);
      }
    };

    loadPatients();
  }, []);

  const handlePatientChange = async (patientId: string) => {
    try {
      await updateCurrentPatient(patientId);
      toast.success("Patient updated successfully");
      router.refresh();
    } catch (error) {
      console.error("BENBEN: Error updating patient:", error);
      toast.error("Failed to update patient");
    }
  };

  if (loading) {
    return <div>Loading patients...</div>;
  }

  return (
    <div className="flex flex-col space-y-2">
      <div>
        <h2 className="text-lg font-semibold">Current Patient</h2>
        <p className="text-zinc-300 text-sm">
          Select the current patient to track seizures for
        </p>
      </div>
      <select
        id="patient-select"
        className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        value={settings.currentPatientId || "kat"}
        onChange={(e) => handlePatientChange(e.target.value)}
      >
        {patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name}
          </option>
        ))}
      </select>
    </div>
  );
}

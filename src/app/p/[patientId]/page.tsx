import { getPublicPatient, getTodaySeizuresPublic } from "@/app/actions";
import { notFound } from "next/navigation";
import PublicPatientPage from "./PublicPatientPage";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const patient = await getPublicPatient(patientId);

  if (!patient) {
    notFound();
  }

  const todayResult = await getTodaySeizuresPublic(patientId);
  const todaySeizures = todayResult.seizures || [];

  return (
    <PublicPatientPage
      patientId={patientId}
      patientName={patient.name}
      quickButtonSeconds={patient.quickButtonSeconds}
      initialSeizures={todaySeizures}
    />
  );
}

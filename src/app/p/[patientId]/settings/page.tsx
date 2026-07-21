import ClientSettings from "@/app/settings/ClientSettings";

export default async function PatientSettingsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <ClientSettings patientId={patientId} />;
}

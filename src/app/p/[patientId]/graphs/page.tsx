import { GraphsContent } from "@/app/graphs/GraphsContent";

export default async function PatientGraphsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <GraphsContent patientId={patientId} />;
}

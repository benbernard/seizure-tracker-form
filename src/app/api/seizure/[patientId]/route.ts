import { submitSeizurePublic } from "@/app/actions";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;

  try {
    const body = await request.json();
    const { duration, notes } = body;

    const result = await submitSeizurePublic(
      patientId,
      duration?.toString(),
      notes || "api",
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting seizure via API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

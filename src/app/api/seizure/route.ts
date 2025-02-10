import { NextResponse } from "next/server";
import { submitSeizure } from "@/app/actions";

function validateDuration(duration: unknown): string | null {
  if (duration === undefined || duration === null) {
    return "Duration is required";
  }

  // Handle both number and string inputs
  const durationNum =
    typeof duration === "string" ? Number.parseFloat(duration) : duration;

  if (typeof durationNum !== "number" || Number.isNaN(durationNum)) {
    return "Duration must be a valid number";
  }

  if (durationNum <= 0) {
    return "Duration must be greater than 0";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { duration, notes } = body;

    const validationError = validateDuration(duration);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await submitSeizure(duration.toString(), notes);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
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

// Keep the GET endpoint for testing
export async function GET() {
  return NextResponse.json({ message: "API endpoint for submitting seizures" });
}

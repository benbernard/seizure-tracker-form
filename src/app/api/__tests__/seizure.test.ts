jest.mock("@/app/actions", () => ({ submitSeizurePublic: jest.fn() }));

import { submitSeizurePublic } from "@/app/actions";
import { POST } from "../seizure/[patientId]/route";

describe("POST /api/seizure/[patientId]", () => {
  test("submits a seizure and returns success", async () => {
    (submitSeizurePublic as jest.Mock).mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/seizure/pat1", {
      method: "POST",
      body: JSON.stringify({ duration: 12, notes: "api note" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ patientId: "pat1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(submitSeizurePublic).toHaveBeenCalledWith("pat1", "12", "api note");
  });

  test("returns 400 when action reports an error", async () => {
    (submitSeizurePublic as jest.Mock).mockResolvedValue({
      error: "Patient not found",
    });

    const request = new Request("http://localhost/api/seizure/missing", {
      method: "POST",
      body: JSON.stringify({ duration: 5 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ patientId: "missing" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Patient not found" });
    expect(submitSeizurePublic).toHaveBeenCalledWith("missing", "5", "api");
  });

  test("returns 500 on unexpected error", async () => {
    (submitSeizurePublic as jest.Mock).mockRejectedValue(new Error("boom"));

    const request = new Request("http://localhost/api/seizure/pat1", {
      method: "POST",
      body: JSON.stringify({ duration: 5 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ patientId: "pat1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to process request" });
  });
});

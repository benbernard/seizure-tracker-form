jest.mock("@/lib/aws/dynamodb");
jest.mock("@/lib/clerk", () => ({
  auth: jest.fn(),
  isLocalAuth: jest.fn(() => false),
}));
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import type * as MockDynamo from "@/lib/aws/__mocks__/dynamodb";
import { auth } from "@/lib/clerk";
import type { clerkClient } from "@clerk/nextjs/server";
import {
  addPatientOwner,
  createMedicationChange,
  createPatient,
  deleteAllSeizures,
  deleteMedicationChange,
  deleteSeizure,
  getPatientOwnerEmails,
  getPatients,
  getSettings,
  getTodaySeizuresPublic,
  listMedicationChanges,
  listSeizures,
  removePatientOwner,
  submitSeizure,
  submitSeizurePublic,
  updateCurrentPatient,
  uploadSeizuresFromCSV,
} from "../actions";

const { getTable, resetTables } = jest.requireMock(
  "@/lib/aws/dynamodb",
) as typeof MockDynamo;

const OWNER_ID = "user_owner";
const OTHER_USER_ID = "user_other";

const CLERK_USERS: Record<string, { id: string; email: string }> = {
  user_owner: { id: "user_owner", email: "owner@example.com" },
  user_friend: { id: "user_friend", email: "friend@example.com" },
  user_other: { id: "user_other", email: "other@example.com" },
};

function mockUserRecord(userId: string) {
  const user = CLERK_USERS[userId];
  if (!user) return undefined;
  return {
    id: user.id,
    email: user.email,
    emailAddresses: [{ id: `${user.id}_email`, emailAddress: user.email }],
    primaryEmailAddressId: `${user.id}_email`,
  };
}

function configureClerkMock() {
  const getUserList = jest.fn(
    async (params: { userId?: string[]; emailAddress?: string[] }) => {
      const userIds = params.userId;
      const emails = params.emailAddress?.map((e: string) => e.toLowerCase());
      const data = Object.values(CLERK_USERS)
        .map((u) => mockUserRecord(u.id))
        .filter((u): u is NonNullable<typeof u> => {
          if (!u) return false;
          if (userIds) return userIds.includes(u.id);
          if (emails) return emails.includes(u.email);
          return false;
        });
      return { data } as unknown as Awaited<
        ReturnType<
          Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]
        >
      >;
    },
  );
  const mock = jest.requireMock("@clerk/nextjs/server") as {
    clerkClient: jest.Mock;
  };
  mock.clerkClient.mockResolvedValue({
    users: { getUserList },
  } as unknown as Awaited<ReturnType<typeof clerkClient>>);
}

function setCurrentUser(userId: string | null) {
  jest
    .mocked(auth)
    .mockResolvedValue({ userId } as Awaited<ReturnType<typeof auth>>);
}

function seedPatient(
  patientId: string,
  ownerId = OWNER_ID,
  allowedUserIds: string[] = [],
) {
  const patients = getTable("patients");
  const existing = patients.find((p) => p.id === patientId);
  const patient = {
    id: patientId,
    name: "Test Patient",
    ownerId,
    allowedUserIds,
    createdAt: 1000,
  };
  if (existing) {
    Object.assign(existing, patient);
  } else {
    patients.push(patient);
  }
  return patient;
}

function seedSeizure(
  patientId: string,
  date: number,
  duration = 10,
  notes = "notes",
) {
  const seizure = { patient: patientId, date, duration, notes };
  getTable("seizures").push(seizure);
  return seizure;
}

function seedMedicationChange(
  patientId: string,
  date: number,
  medication = "Med",
  dosage = "10mg",
  type: "start" | "stop" | "adjust" = "start",
  notes?: string,
) {
  const change = {
    id: patientId,
    date,
    medication,
    dosage,
    type,
    notes,
  };
  getTable("medication-changes").push(change);
  return change;
}

describe("seizure actions", () => {
  beforeEach(() => {
    resetTables();
    setCurrentUser(OWNER_ID);
    configureClerkMock();
    jest.spyOn(Date, "now").mockReturnValue(1707542775000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("submitSeizurePublic", () => {
    test("submits a seizure with a description", async () => {
      seedPatient("pat1");
      const result = await submitSeizurePublic(
        "pat1",
        "10",
        "description text",
      );

      expect(result).toEqual({ success: true });
      const seizures = getTable("seizures");
      expect(seizures).toHaveLength(1);
      expect(seizures[0]).toMatchObject({
        patient: "pat1",
        duration: 10,
        notes: "description text",
      });
      expect(seizures[0].date).toBe(Math.floor(1707542775));
    });

    test("quick submit uses QuickAction notes", async () => {
      seedPatient("pat1");
      const result = await submitSeizurePublic("pat1", "15", "QuickAction");

      expect(result).toEqual({ success: true });
      const seizures = getTable("seizures");
      expect(seizures).toHaveLength(1);
      expect(seizures[0]).toMatchObject({
        patient: "pat1",
        duration: 15,
        notes: "QuickAction",
      });
    });

    test("rejects invalid duration", async () => {
      seedPatient("pat1");
      const result = await submitSeizurePublic("pat1", "0", "note");

      expect(result).toEqual({ error: "Duration must be a positive number" });
      expect(getTable("seizures")).toHaveLength(0);
    });

    test("rejects unknown patient", async () => {
      const result = await submitSeizurePublic("missing", "10", "note");

      expect(result).toEqual({ error: "Patient not found" });
    });
  });

  describe("getTodaySeizuresPublic", () => {
    test("returns only today seizures for a patient", async () => {
      seedPatient("pat1");
      seedSeizure("pat1", 1707542775, 5);
      seedSeizure("pat1", 1707465600, 6);
      seedSeizure("pat1", 1707379200, 7);

      const result = await getTodaySeizuresPublic("pat1");

      expect(result.error).toBeUndefined();
      expect(result.seizures).toBeDefined();
      expect(result.seizures).toHaveLength(2);
      expect(result.seizures?.map((s) => s.duration)).toEqual([5, 6]);
    });

    test("returns error for missing patient", async () => {
      const result = await getTodaySeizuresPublic("missing");
      expect(result.error).toBe("Patient not found");
    });
  });

  describe("submitSeizure (authed)", () => {
    test("owner can submit a seizure", async () => {
      seedPatient("pat1");
      const result = await submitSeizure("pat1", "20", "authed note");

      expect(result).toEqual({ success: true });
      expect(getTable("seizures")).toHaveLength(1);
      expect(getTable("seizures")[0].notes).toBe("authed note");
    });

    test("non-owner cannot submit a seizure", async () => {
      seedPatient("pat1", OWNER_ID);
      setCurrentUser(OTHER_USER_ID);
      const result = await submitSeizure("pat1", "20", "note");

      expect(result).toEqual({ error: "Failed to create seizure" });
      expect(getTable("seizures")).toHaveLength(0);
    });
  });

  describe("listSeizures (past history)", () => {
    test("returns seizure history for an owner", async () => {
      seedPatient("pat1");
      seedSeizure("pat1", 100, 5);
      seedSeizure("pat1", 200, 10);
      seedSeizure("pat1", 300, 15);

      const result = await listSeizures("pat1", 0, 500);

      expect(result.error).toBeUndefined();
      expect(result.seizures).toBeDefined();
      expect(result.seizures).toHaveLength(3);
      expect(result.seizures?.map((s) => s.date)).toEqual([300, 200, 100]);
    });

    test("non-owner cannot view history", async () => {
      seedPatient("pat1", OWNER_ID);
      seedSeizure("pat1", 100, 5);
      setCurrentUser(OTHER_USER_ID);

      const result = await listSeizures("pat1", 0, 500);

      expect(result).toEqual({ error: "Failed to list seizures" });
    });
  });

  describe("deleteSeizure", () => {
    test("owner can remove a seizure", async () => {
      seedPatient("pat1");
      seedSeizure("pat1", 100, 5);

      const result = await deleteSeizure("pat1", 100);

      expect(result).toEqual({ success: true });
      expect(getTable("seizures")).toHaveLength(0);
    });

    test("non-owner cannot remove a seizure", async () => {
      seedPatient("pat1", OWNER_ID);
      seedSeizure("pat1", 100, 5);
      setCurrentUser(OTHER_USER_ID);

      const result = await deleteSeizure("pat1", 100);

      expect(result).toEqual({ error: "Failed to delete seizure" });
    });
  });

  describe("deleteAllSeizures", () => {
    test("owner removes all seizures", async () => {
      seedPatient("pat1");
      seedSeizure("pat1", 100, 5);
      seedSeizure("pat1", 200, 10);
      seedSeizure("pat1", 300, 15);

      const result = await deleteAllSeizures("pat1");

      expect(result).toEqual({ success: true, count: 3 });
      expect(getTable("seizures")).toHaveLength(0);
    });

    test("does not affect other patients' seizures", async () => {
      seedPatient("pat1");
      seedPatient("pat2");
      seedSeizure("pat1", 100, 5);
      seedSeizure("pat2", 200, 10);

      const result = await deleteAllSeizures("pat1");

      expect(result).toEqual({ success: true, count: 1 });
      expect(getTable("seizures")).toHaveLength(1);
      expect(getTable("seizures")[0].patient).toBe("pat2");
    });

    test("non-owner cannot delete all seizures", async () => {
      seedPatient("pat1", OWNER_ID);
      seedSeizure("pat1", 100, 5);
      setCurrentUser(OTHER_USER_ID);

      const result = await deleteAllSeizures("pat1");

      expect(result).toEqual({ error: "Failed to delete seizures" });
      expect(getTable("seizures")).toHaveLength(1);
    });
  });

  describe("uploadSeizuresFromCSV", () => {
    test("imports seizures from CSV", async () => {
      seedPatient("pat1");
      const csv = [
        "Time,Duration,Notes",
        "2024-02-10T08:00:00-08:00,5,Morning",
        "2024-02-10T09:00:00-08:00,10,Evening",
      ].join("\n");

      const result = await uploadSeizuresFromCSV("pat1", csv);

      expect(result.error).toBeUndefined();
      expect(result.successCount).toBe(2);
      expect(result.totalRows).toBe(2);
      expect(result.failedRows).toHaveLength(0);
      expect(getTable("seizures")).toHaveLength(2);
      expect(getTable("seizures").map((s) => s.duration)).toEqual([5, 10]);
    });

    test("reports invalid rows and still imports valid rows", async () => {
      seedPatient("pat1");
      const csv = [
        "Time,Duration,Notes",
        "bad date,5,OK",
        "2024-02-10T08:00:00-08:00,10,Good",
        "2024-02-10T09:00:00-08:00,not number,Bad",
      ].join("\n");

      const result = await uploadSeizuresFromCSV("pat1", csv);

      expect(result.successCount).toBe(1);
      expect(result.failedRows).toHaveLength(2);
      expect(getTable("seizures")).toHaveLength(1);
      expect(getTable("seizures")[0].duration).toBe(10);
    });

    test("non-owner cannot import CSV", async () => {
      seedPatient("pat1", OWNER_ID);
      setCurrentUser(OTHER_USER_ID);
      const csv = "Time,Duration,Notes\n2024-02-10T08:00:00-08:00,5,Note";

      const result = await uploadSeizuresFromCSV("pat1", csv);

      expect(result).toEqual({ error: "Failed to process CSV upload" });
      expect(getTable("seizures")).toHaveLength(0);
    });
  });

  describe("medication changes", () => {
    test("owner can add, list, and remove a medication change", async () => {
      seedPatient("pat1");
      const change = {
        id: "pat1",
        date: 1000,
        medication: "Keppra",
        dosage: "500mg",
        type: "start" as const,
        notes: "started",
      };

      const createResult = await createMedicationChange(change);
      expect(createResult).toEqual({ success: true });

      const listResult = await listMedicationChanges("pat1");
      expect(listResult.error).toBeUndefined();
      expect(listResult.medicationChanges).toBeDefined();
      expect(listResult.medicationChanges).toHaveLength(1);
      expect(listResult.medicationChanges?.[0]).toMatchObject(change);

      const deleteResult = await deleteMedicationChange("pat1", 1000);
      expect(deleteResult).toEqual({ success: true });

      const after = await listMedicationChanges("pat1");
      expect(after.medicationChanges).toHaveLength(0);
    });

    test("non-owner cannot create a medication change", async () => {
      seedPatient("pat1", OWNER_ID);
      setCurrentUser(OTHER_USER_ID);
      const change = {
        id: "pat1",
        date: 1000,
        medication: "Keppra",
        dosage: "500mg",
        type: "start" as const,
      };

      const result = await createMedicationChange(change);
      expect(result).toEqual({ error: "Failed to create medication change" });
    });
  });

  describe("patient management", () => {
    test("createPatient adds a patient owned by the current user", async () => {
      const result = await createPatient("Alex");

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.patient).toMatchObject({
        name: "Alex",
        ownerId: OWNER_ID,
        allowedUserIds: [],
      });
      expect(getTable("patients")).toHaveLength(1);
    });

    test("getPatients returns only patients the user owns or has access to", async () => {
      seedPatient("pat1", OWNER_ID);
      seedPatient("pat2", OTHER_USER_ID);
      seedPatient("pat3", OTHER_USER_ID, [OWNER_ID]);

      const result = await getPatients();

      expect(result.map((p) => p.id)).toEqual(["pat1", "pat3"]);
    });

    test("unauthenticated user cannot get patients", async () => {
      setCurrentUser(null);
      await expect(getPatients()).rejects.toThrow("Failed to get patients");
    });

    test("addPatientOwner grants access to another user", async () => {
      seedPatient("pat1");
      const result = await addPatientOwner("pat1", "friend@example.com");

      expect(result).toEqual({ success: true });
      const patient = getTable("patients").find((p) => p.id === "pat1");
      expect(patient?.allowedUserIds).toEqual(["user_friend"]);
    });

    test("addPatientOwner rejects invalid email", async () => {
      seedPatient("pat1");

      expect(await addPatientOwner("pat1", "not-an-email")).toEqual({
        error: "A valid email address is required",
      });
    });

    test("addPatientOwner rejects unknown email", async () => {
      seedPatient("pat1");

      expect(await addPatientOwner("pat1", "unknown@example.com")).toEqual({
        error: "No user found with that email address",
      });
    });

    test("addPatientOwner rejects duplicate or self owners", async () => {
      seedPatient("pat1", OWNER_ID, ["user_friend"]);

      expect(await addPatientOwner("pat1", "friend@example.com")).toEqual({
        error: "User already has access to this patient",
      });
      expect(await addPatientOwner("pat1", "owner@example.com")).toEqual({
        error: "You already own this patient",
      });
    });

    test("removePatientOwner revokes access", async () => {
      seedPatient("pat1", OWNER_ID, ["user_friend"]);
      const result = await removePatientOwner("pat1", "user_friend");

      expect(result).toEqual({ success: true });
      const patient = getTable("patients").find((p) => p.id === "pat1");
      expect(patient?.allowedUserIds).toEqual([]);
    });

    test("non-owner cannot add or remove owners", async () => {
      seedPatient("pat1", OWNER_ID, ["user_friend"]);
      setCurrentUser(OTHER_USER_ID);

      expect(await addPatientOwner("pat1", "third@example.com")).toEqual({
        error: "Failed to add patient owner",
      });
      expect(await removePatientOwner("pat1", "user_friend")).toEqual({
        error: "Failed to remove patient owner",
      });
    });

    test("getPatientOwnerEmails returns the owner and allowed users", async () => {
      seedPatient("pat1", OWNER_ID, ["user_friend"]);

      const result = await getPatientOwnerEmails("pat1");

      expect(result.error).toBeUndefined();
      expect(result.owners).toEqual([
        {
          userId: "user_owner",
          email: "owner@example.com",
          isCurrentUser: true,
          isOwner: true,
        },
        {
          userId: "user_friend",
          email: "friend@example.com",
          isCurrentUser: false,
          isOwner: false,
        },
      ]);
    });
  });

  describe("settings", () => {
    test("getSettings returns current user settings", async () => {
      setCurrentUser(OWNER_ID);
      const result = await getSettings();

      expect(result.id).toBe(OWNER_ID);
      expect(result.currentPatientId).toBeUndefined();
    });

    test("updateCurrentPatient requires ownership", async () => {
      seedPatient("pat1", OWNER_ID);
      await updateCurrentPatient("pat1");

      const settings = getTable("settings").find((s) => s.id === OWNER_ID);
      expect(settings?.currentPatientId).toBe("pat1");
    });

    test("updateCurrentPatient fails for non-owner", async () => {
      seedPatient("pat1", OWNER_ID);
      setCurrentUser(OTHER_USER_ID);

      await expect(updateCurrentPatient("pat1")).rejects.toThrow(
        "Failed to update current patient",
      );
    });
  });
});

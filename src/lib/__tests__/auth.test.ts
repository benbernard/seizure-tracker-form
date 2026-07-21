jest.mock("@/lib/aws/dynamodb");
jest.mock("@/lib/clerk", () => ({
  auth: jest.fn(),
  isLocalAuth: jest.fn(() => false),
}));
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn(),
}));

import type * as MockDynamo from "@/lib/aws/__mocks__/dynamodb";
import { auth } from "@/lib/clerk";
import type { clerkClient } from "@clerk/nextjs/server";
import {
  assertOwnsPatient,
  getCurrentUser,
  getCurrentUserId,
  getPatientById,
  isSuperUser,
  patientIsOwnedBy,
} from "../auth";
import type { Patient } from "../aws/schema";

const { getTable, resetTables } = jest.requireMock(
  "@/lib/aws/dynamodb",
) as typeof MockDynamo;

const OWNER_ID = "user_owner";
const OTHER_USER_ID = "user_other";

const CLERK_USERS: Record<string, { id: string; email: string }> = {
  user_owner: { id: "user_owner", email: "owner@example.com" },
  user_other: { id: "user_other", email: "other@example.com" },
};

function configureClerkMock() {
  const getUserList = jest.fn(
    async (params: { userId?: string[]; emailAddress?: string[] }) => {
      const userIds = params.userId;
      const emails = params.emailAddress?.map((e: string) => e.toLowerCase());
      const data = Object.values(CLERK_USERS)
        .map((user) => ({
          id: user.id,
          email: user.email,
          emailAddresses: [
            { id: `${user.id}_email`, emailAddress: user.email },
          ],
          primaryEmailAddressId: `${user.id}_email`,
        }))
        .filter((user) => {
          if (userIds) return userIds.includes(user.id);
          if (emails) return emails.includes(user.email);
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
  const patient = {
    id: patientId,
    name: "Test Patient",
    ownerId,
    allowedUserIds,
    createdAt: 1000,
  };
  getTable("patients").push(patient);
  return patient;
}

describe("auth helpers", () => {
  beforeEach(() => {
    resetTables();
    configureClerkMock();
    setCurrentUser(OWNER_ID);
  });

  describe("getCurrentUserId", () => {
    test("returns the authenticated user id", async () => {
      await expect(getCurrentUserId()).resolves.toBe(OWNER_ID);
    });

    test("throws when user is not authenticated", async () => {
      setCurrentUser(null);
      await expect(getCurrentUserId()).rejects.toThrow("Unauthorized");
    });
  });

  describe("getPatientById", () => {
    test("returns a patient when one exists", async () => {
      seedPatient("pat1");
      const result = await getPatientById("pat1");
      expect(result).toMatchObject({ id: "pat1", name: "Test Patient" });
    });

    test("returns undefined when patient is missing", async () => {
      const result = await getPatientById("missing");
      expect(result).toBeUndefined();
    });
  });

  describe("patientIsOwnedBy", () => {
    test("returns true for the owner", () => {
      const patient = seedPatient("pat1", OWNER_ID);
      expect(patientIsOwnedBy(patient, OWNER_ID)).toBe(true);
    });

    test("returns true for an allowed user", () => {
      const patient = seedPatient("pat1", OWNER_ID, [OTHER_USER_ID]);
      expect(patientIsOwnedBy(patient, OTHER_USER_ID)).toBe(true);
    });

    test("returns false for an unrelated user", () => {
      const patient = seedPatient("pat1", OWNER_ID);
      expect(patientIsOwnedBy(patient, "user_random")).toBe(false);
    });

    test("handles missing allowedUserIds", () => {
      const patient = {
        id: "pat1",
        name: "Test",
        ownerId: OWNER_ID,
        createdAt: 1,
      };
      expect(patientIsOwnedBy(patient, OWNER_ID)).toBe(true);
      expect(patientIsOwnedBy(patient, OTHER_USER_ID)).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    test("returns the current user id and email", async () => {
      const user = await getCurrentUser();
      expect(user).toEqual({
        userId: OWNER_ID,
        email: "owner@example.com",
      });
    });
  });

  describe("isSuperUser", () => {
    test("returns true when the email is in the env list", () => {
      process.env.SUPER_USER_EMAILS = "owner@example.com";
      expect(isSuperUser("owner@example.com")).toBe(true);
      process.env.SUPER_USER_EMAILS = undefined;
    });

    test("returns false when the env list is empty", () => {
      process.env.SUPER_USER_EMAILS = undefined;
      expect(isSuperUser("owner@example.com")).toBe(false);
    });
  });

  describe("assertOwnsPatient", () => {
    test("returns the patient for the owner", async () => {
      seedPatient("pat1");
      const result = await assertOwnsPatient("pat1");
      expect(result.id).toBe("pat1");
    });

    test("returns the patient for a super-user", async () => {
      process.env.SUPER_USER_EMAILS = "owner@example.com";
      seedPatient("pat1", OTHER_USER_ID);
      const result = await assertOwnsPatient("pat1");
      expect(result.id).toBe("pat1");
      process.env.SUPER_USER_EMAILS = undefined;
    });

    test("returns the patient for an allowed user", async () => {
      seedPatient("pat1", OWNER_ID, [OTHER_USER_ID]);
      setCurrentUser(OTHER_USER_ID);
      const result = await assertOwnsPatient("pat1");
      expect(result.id).toBe("pat1");
    });

    test("throws when patient is missing", async () => {
      await expect(assertOwnsPatient("missing")).rejects.toThrow(
        "Patient not found",
      );
    });

    test("throws when another user does not have access", async () => {
      seedPatient("pat1", OWNER_ID);
      setCurrentUser(OTHER_USER_ID);
      await expect(assertOwnsPatient("pat1")).rejects.toThrow("Forbidden");
    });
  });
});

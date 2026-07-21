const mockSend = jest.fn();
const mockClient = { send: mockSend };
const mockRunScript = jest.fn(
  async (_name: string, fn: () => Promise<void>) => {
    return fn();
  },
);

declare global {
  var __scriptTestMockClient__: typeof mockClient;
  var __scriptTestRunScript__: typeof mockRunScript;
}

globalThis.__scriptTestMockClient__ = mockClient;
globalThis.__scriptTestRunScript__ = mockRunScript;

jest.mock("../utils", () => ({
  createDynamoClient: jest.fn(() => globalThis.__scriptTestMockClient__),
  runScript: globalThis.__scriptTestRunScript__,
}));
jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
}));

import { readFile, writeFile } from "node:fs/promises";
import type {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const tableEnv = {
  seizures: process.env.SEIZURES_TABLE || "seizures",
  patients: process.env.PATIENTS_TABLE || "patients",
  settings: process.env.SETTINGS_TABLE || "settings",
  medicationChanges:
    process.env.MEDICATION_CHANGES_TABLE || "medication-changes",
};

function waitForScript() {
  return mockRunScript.mock.results[0]?.value;
}

function isCommand<T extends { constructor: { name: string } }>(
  command: unknown,
  name: string,
): command is T {
  return (
    (command as { constructor?: { name?: string } }).constructor?.name === name
  );
}

describe("scripts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("backup-tables", () => {
    test("backs up all tables and writes a manifest", async () => {
      mockClient.send.mockResolvedValue({ Items: [{ id: "row-1" }] });

      await jest.isolateModulesAsync(async () => {
        await import("../backup-tables");
      });
      await waitForScript();

      const scanCommands = mockClient.send.mock.calls
        .map(([command]) => command)
        .filter((command): command is ScanCommand =>
          isCommand(command, "ScanCommand"),
        );
      expect(scanCommands).toHaveLength(4);
      const tableNames = scanCommands.map((command) => command.input.TableName);
      expect(tableNames).toEqual(
        expect.arrayContaining([
          tableEnv.seizures,
          tableEnv.patients,
          tableEnv.settings,
          tableEnv.medicationChanges,
        ]),
      );

      expect(writeFile).toHaveBeenCalledTimes(5);
      const manifestCall = (writeFile as jest.Mock).mock.calls.find((call) =>
        call[0].toString().endsWith("manifest.json"),
      );
      expect(manifestCall).toBeDefined();
      const manifest = JSON.parse(manifestCall?.[1]);
      expect(Object.keys(manifest.tables)).toHaveLength(4);
    });
  });

  describe("restore-tables", () => {
    test("restores each table from the manifest", async () => {
      const manifest = {
        timestamp: "2024-01-01T00:00:00.000Z",
        tables: {
          seizures: { file: "seizures-2024-01-01.json", count: 1 },
          patients: { file: "patients-2024-01-01.json", count: 1 },
        },
      };
      (readFile as jest.Mock).mockImplementation(async (path: string) => {
        if (path.toString().endsWith("manifest.json")) {
          return JSON.stringify(manifest);
        }
        if (path.toString().includes("seizures")) {
          return JSON.stringify([{ patient: "kat", date: 1, duration: 5 }]);
        }
        if (path.toString().includes("patients")) {
          return JSON.stringify([{ id: "kat", name: "Kat" }]);
        }
        return "[]";
      });
      mockClient.send.mockResolvedValue({});

      await jest.isolateModulesAsync(async () => {
        await import("../restore-tables");
      });
      await waitForScript();

      const batchCommands = mockClient.send.mock.calls
        .map(([command]) => command)
        .filter((command): command is BatchWriteCommand =>
          isCommand(command, "BatchWriteCommand"),
        );
      expect(batchCommands.length).toBeGreaterThanOrEqual(2);
      const tableNames = batchCommands.map(
        (command) => Object.keys(command.input.RequestItems ?? {})[0],
      );
      expect(tableNames).toEqual(
        expect.arrayContaining([tableEnv.seizures, tableEnv.patients]),
      );
    });
  });

  describe("migrate-ownership", () => {
    test("sets ownerId on the existing patient and creates settings", async () => {
      const ownerId = "user_owner";
      process.argv = ["node", "migrate-ownership.ts", ownerId];
      mockClient.send.mockImplementation(async (command) => {
        if (isCommand<GetCommand>(command, "GetCommand")) {
          const key = command.input.Key?.id;
          if (key === "kat") {
            return { Item: { id: "kat", name: "Kat", createdAt: 1 } };
          }
          if (key === ownerId) {
            return { Item: null };
          }
        }
        return {};
      });

      await jest.isolateModulesAsync(async () => {
        await import("../migrate-ownership");
      });
      await waitForScript();

      const putCommands = mockClient.send.mock.calls
        .map(([command]) => command)
        .filter((command): command is PutCommand =>
          isCommand(command, "PutCommand"),
        );
      expect(putCommands).toHaveLength(2);
      const patientPut = putCommands.find(
        (command) => command.input.Item?.id === "kat",
      );
      const settingsPut = putCommands.find(
        (command) => command.input.Item?.id === ownerId,
      );
      expect(patientPut?.input.Item).toMatchObject({
        id: "kat",
        ownerId,
      });
      expect(settingsPut?.input.Item).toMatchObject({
        id: ownerId,
        currentPatientId: "kat",
      });
    });
  });
});

import { DateTime } from "luxon";
import { processSeizureData, type SeizureDataPoint } from "../utils";
import type { Seizure } from "@/lib/aws/schema";
import { createDateTime } from "@/lib/utils/dates";

describe("Graph Date Processing", () => {
  // Mock seizures at different times of day to test timezone handling
  const mockSeizures: Seizure[] = [
    {
      patient: "test",
      date: createDateTime("2024-02-09T07:59:59.000Z").toSeconds(), // 11:59 PM Feb 8 Pacific
      duration: 30,
      notes: "Late night seizure UTC",
    },
    {
      patient: "test",
      date: createDateTime("2024-02-09T08:00:00.000Z").toSeconds(), // 12:00 AM Feb 9 Pacific
      duration: 30,
      notes: "Midnight seizure Pacific",
    },
    {
      patient: "test",
      date: createDateTime("2024-02-09T15:59:59.000Z").toSeconds(), // 7:59 AM Feb 9 Pacific
      duration: 30,
      notes: "Morning seizure Pacific",
    },
    {
      patient: "test",
      date: createDateTime("2024-02-10T07:59:59.000Z").toSeconds(), // 11:59 PM Feb 9 Pacific
      duration: 30,
      notes: "Late night seizure Pacific",
    },
  ];

  beforeAll(() => {
    // Set a fixed time for tests
    jest.useFakeTimers();
    jest.setSystemTime(createDateTime("2024-02-10T08:00:00.000Z").toJSDate()); // Midnight Feb 10 Pacific
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("correctly groups seizures by Pacific date", () => {
    const data = processSeizureData(mockSeizures);

    // Convert data to a map for easier testing
    const dateMap = new Map(
      data.map(({ date, count }: SeizureDataPoint) => [date, count]),
    );

    // Feb 8 should have 1 seizure (the 11:59 PM one)
    expect(dateMap.get("2024-02-08")).toBe(1);

    // Feb 9 should have 3 seizures (midnight, morning, and late night)
    expect(dateMap.get("2024-02-09")).toBe(3);

    // Feb 10 should have 0 seizures
    expect(dateMap.get("2024-02-10")).toBe(0);
  });

  test("handles 6-week window correctly", () => {
    const data = processSeizureData([]);

    // Should have 43 days (6 weeks + today)
    expect(data.length).toBe(43);

    // First date should be 6 weeks ago
    const sixWeeksAgo = DateTime.fromISO("2024-02-10")
      .setZone("America/Los_Angeles")
      .minus({ weeks: 6 })
      .toFormat("yyyy-MM-dd");
    expect(data[0].date).toBe(sixWeeksAgo);

    // Last date should be today
    expect(data[data.length - 1].date).toBe("2024-02-10");
  });

  test("handles custom start date correctly", () => {
    const startDate = createDateTime("2024-02-08T08:00:00.000Z").toJSDate(); // Midnight Feb 8 Pacific
    const data = processSeizureData(mockSeizures, startDate);

    // Should have 3 days (Feb 8, 9, 10)
    expect(data.length).toBe(3);

    // Convert data to a map for easier testing
    const dateMap = new Map(
      data.map(({ date, count }: SeizureDataPoint) => [date, count]),
    );

    expect(dateMap.get("2024-02-08")).toBe(1);
    expect(dateMap.get("2024-02-09")).toBe(3);
    expect(dateMap.get("2024-02-10")).toBe(0);
  });
});

import {
  createDateTime,
  getCurrentUtcTimestamp,
  pacificToUtcTimestamp,
  utcToPacificDate,
  formatPacificDateTime,
  getCurrentPacificDayStartTimestamp,
  getCurrentPacificDayEndTimestamp,
} from "../dates";

describe("Date Utilities", () => {
  // Test case 1: System time is UTC
  describe("when system time is UTC", () => {
    // 2024-02-09 21:26:15 Pacific
    const utcTime = createDateTime("2024-02-10T05:26:15.000+00:00");

    test("getCurrentUtcTimestamp returns correct UTC timestamp", () => {
      const timestamp = getCurrentUtcTimestamp(utcTime);
      expect(timestamp).toBe(1707542775);
    });

    test("getCurrentPacificDayStartTimestamp returns correct UTC timestamp for Pacific day start", () => {
      const timestamp = getCurrentPacificDayStartTimestamp(utcTime);
      expect(timestamp).toBe(1707465600); // 2024-02-09 08:00:00 UTC (midnight Pacific)
    });
  });

  // Test case 2: System time is Pacific
  describe("when system time is Pacific", () => {
    // 2024-02-09 21:26:15 Pacific
    const pacificTime = createDateTime(
      "2024-02-09T21:26:15.000-08:00",
      "America/Los_Angeles",
    );

    test("getCurrentUtcTimestamp still returns UTC regardless of system time", () => {
      const timestamp = getCurrentUtcTimestamp(pacificTime);
      expect(timestamp).toBe(1707542775);
    });
  });

  // Test case 3: Importing from API (uses getCurrentUtcTimestamp)
  describe("API import", () => {
    const apiTime = createDateTime("2024-02-10T05:26:15.000+00:00");

    test("stores correct UTC timestamp", () => {
      const timestamp = getCurrentUtcTimestamp(apiTime);
      expect(timestamp).toBe(1707542775);

      // Verify it formats back to Pacific correctly
      const { dateStr, timeStr } = formatPacificDateTime(timestamp);
      expect(dateStr).toBe("2024-02-09");
      expect(timeStr).toBe("9:26 PM");
    });
  });

  // Test case 4: Web form submission (uses getCurrentUtcTimestamp)
  describe("Web form submission", () => {
    const webTime = createDateTime("2024-02-10T05:26:15.000+00:00");

    test("stores correct UTC timestamp", () => {
      const timestamp = getCurrentUtcTimestamp(webTime);
      expect(timestamp).toBe(1707542775);

      // Verify it formats back to Pacific correctly
      const { dateStr, timeStr } = formatPacificDateTime(timestamp);
      expect(dateStr).toBe("2024-02-09");
      expect(timeStr).toBe("9:26 PM");
    });
  });

  // Test case 5: CSV Import (uses pacificToUtcTimestamp)
  describe("CSV import", () => {
    test("converts Pacific time to correct UTC timestamp", () => {
      // Create a Date object representing Pacific time
      const pacificDate = new Date("2024-02-09T21:26:15.000-08:00");
      const timestamp = pacificToUtcTimestamp(pacificDate);
      expect(timestamp).toBe(1707542775);

      // Verify it formats back correctly
      const { dateStr, timeStr } = formatPacificDateTime(timestamp);
      expect(dateStr).toBe("2024-02-09");
      expect(timeStr).toBe("9:26 PM");
    });
  });

  // Test case 6: Sheet Import (uses pacificToUtcTimestamp)
  describe("Sheet import", () => {
    test("converts Pacific time to correct UTC timestamp", () => {
      // Sheet time is already in Pacific
      const sheetDate = new Date("2024-02-09T21:26:15.000-08:00");
      const timestamp = pacificToUtcTimestamp(sheetDate);
      expect(timestamp).toBe(1707542775);

      // Verify it formats back correctly
      const { dateStr, timeStr } = formatPacificDateTime(timestamp);
      expect(dateStr).toBe("2024-02-09");
      expect(timeStr).toBe("9:26 PM");
    });
  });

  // Test case 7: Deleting rows (involves both UTC and Pacific times)
  describe("Delete operations", () => {
    test("converts between UTC and Pacific correctly for deletion", () => {
      // Start with a UTC timestamp from DynamoDB
      const dynamoTimestamp = 1707542775; // 2024-02-09 21:26:15 Pacific

      // Convert to Pacific Date for sheet comparison
      const pacificDate = utcToPacificDate(dynamoTimestamp);

      // Convert back to UTC timestamp
      const reconvertedTimestamp = pacificToUtcTimestamp(pacificDate);

      // Should match original timestamp
      expect(reconvertedTimestamp).toBe(dynamoTimestamp);

      // Verify Pacific formatting
      const { dateStr, timeStr } = formatPacificDateTime(dynamoTimestamp);
      expect(dateStr).toBe("2024-02-09");
      expect(timeStr).toBe("9:26 PM");
    });
  });
});

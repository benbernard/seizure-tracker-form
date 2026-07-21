import { generateUniquePatientId, slugify } from "@/lib/utils/slug";

describe("slugify", () => {
  test("converts a simple name to kebab-case", () => {
    expect(slugify("Alex New")).toBe("alex-new");
  });

  test("lowercases the result", () => {
    expect(slugify("KAT")).toBe("kat");
  });

  test("trims leading and trailing non-alphanumeric characters", () => {
    expect(slugify("  Alex New  ")).toBe("alex-new");
    expect(slugify("-Alex New-")).toBe("alex-new");
  });

  test("collapses multiple separators", () => {
    expect(slugify("Alex   New")).toBe("alex-new");
    expect(slugify("Alex--New")).toBe("alex-new");
  });

  test("removes non-alphanumeric characters", () => {
    expect(slugify("Alex (New)")).toBe("alex-new");
    expect(slugify("Dr. Seizure Tracker")).toBe("dr-seizure-tracker");
  });
});

describe("generateUniquePatientId", () => {
  test("returns the base slug when there is no conflict", () => {
    expect(generateUniquePatientId("Alex New", new Set())).toBe("alex-new");
  });

  test("appends a counter when the base slug is taken", () => {
    const existing = new Set(["alex-new"]);
    expect(generateUniquePatientId("Alex New", existing)).toBe("alex-new-2");
  });

  test("increments the counter until a unique slug is found", () => {
    const existing = new Set(["alex-new", "alex-new-2", "alex-new-3"]);
    expect(generateUniquePatientId("Alex New", existing)).toBe("alex-new-4");
  });

  test("throws when it cannot find a unique slug", () => {
    const existing = new Set<string>();
    for (let i = 1; i <= 1000; i++) {
      existing.add(i === 1 ? "alex-new" : `alex-new-${i}`);
    }
    expect(() => generateUniquePatientId("Alex New", existing)).toThrow(
      "Unable to generate unique patient ID for name: Alex New",
    );
  });
});

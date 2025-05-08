import { jobSearchSchema } from "@routes/jobs/index.schema";
import { JobState } from "@services/types";
import { describe, expect, it } from "vitest";

describe("Jobs Route Search Schema", () => {
  it("validates search parameters correctly", () => {
    // Test default values
    const defaultSearch = {};
    const defaultResult = jobSearchSchema.parse(defaultSearch);
    expect(defaultResult).toEqual({
      limit: 20,
      state: JobState.Running,
    });

    // Test valid limit
    const validLimitSearch = { limit: 40 };
    const validLimitResult = jobSearchSchema.parse(validLimitSearch);
    expect(validLimitResult).toEqual({
      limit: 40,
      state: JobState.Running,
    });

    // Test minimum limit
    const minLimitSearch = { limit: 20 };
    const minLimitResult = jobSearchSchema.parse(minLimitSearch);
    expect(minLimitResult).toEqual({
      limit: 20,
      state: JobState.Running,
    });

    // Test maximum limit
    const maxLimitSearch = { limit: 200 };
    const maxLimitResult = jobSearchSchema.parse(maxLimitSearch);
    expect(maxLimitResult).toEqual({
      limit: 200,
      state: JobState.Running,
    });

    // Test string limit (should be coerced to number)
    const stringLimitSearch = { limit: "40" };
    const stringLimitResult = jobSearchSchema.parse(stringLimitSearch);
    expect(stringLimitResult).toEqual({
      limit: 40,
      state: JobState.Running,
    });
  });

  it("handles invalid search parameters", () => {
    // Test limit below minimum
    expect(() => jobSearchSchema.parse({ limit: 10 })).toThrow();

    // Test limit above maximum
    expect(() => jobSearchSchema.parse({ limit: 300 })).toThrow();

    // Test invalid limit type
    expect(() => jobSearchSchema.parse({ limit: "invalid" })).toThrow();
  });
});

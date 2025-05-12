import { useFeatures } from "@contexts/Features.hook";
import { $userSettings } from "@stores/settings";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSettings } from "./use-settings";

// Mock nanostores/react
vi.mock("@nanostores/react", () => ({
  useStore: vi.fn().mockImplementation((store) => store.get()),
}));

// Mock Features context
vi.mock("@contexts/Features.hook", () => ({
  useFeatures: vi.fn(),
}));

describe("useSettings", () => {
  it("should return default show job args value when no override", () => {
    // Mock Features hook
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: {
        jobListHideArgsByDefault: true,
      },
    });

    // Mock empty settings
    vi.spyOn($userSettings, "get").mockReturnValue({});

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(false);
  });

  it("should return override when set to true", () => {
    // Mock Features hook with hide args by default
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: {
        jobListHideArgsByDefault: true,
      },
    });

    // Mock settings with showJobArgs true
    vi.spyOn($userSettings, "get").mockReturnValue({ showJobArgs: true });

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(true);
  });

  it("should return override when set to false", () => {
    // Mock Features hook with show args by default
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: {
        jobListHideArgsByDefault: false,
      },
    });

    // Mock settings with showJobArgs false
    vi.spyOn($userSettings, "get").mockReturnValue({ showJobArgs: false });

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(false);
  });
});

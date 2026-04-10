import { $userSettings } from "@stores/settings";
import { createFeatures } from "@test/utils/features";
import { renderHook } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";

import { useSettings } from "./use-settings";

type UseFeatures = typeof import("@contexts/Features.hook").useFeatures;
type UseStore = typeof import("@nanostores/react").useStore;

const { mockUseFeatures, mockUseStore } = vi.hoisted(() => ({
  mockUseFeatures: vi.fn() as MockedFunction<UseFeatures>,
  mockUseStore: vi.fn() as MockedFunction<UseStore>,
}));

// Mock nanostores/react
vi.mock("@nanostores/react", () => ({
  useStore: mockUseStore,
}));

// Mock Features context
vi.mock("@contexts/Features.hook", () => ({
  useFeatures: mockUseFeatures,
}));

describe("useSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseFeatures.mockReset();
    mockUseStore.mockReset();
    mockUseStore.mockImplementation((store) => store.get());
  });

  it("should return default show job args value when no override", () => {
    // Mock Features hook
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    // Mock empty settings
    vi.spyOn($userSettings, "get").mockReturnValue({});

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(false);
  });

  it("should return override when set to true", () => {
    // Mock Features hook with hide args by default
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    // Mock settings with showJobArgs true
    vi.spyOn($userSettings, "get").mockReturnValue({ showJobArgs: true });

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(true);
  });

  it("should return override when set to false", () => {
    // Mock Features hook with show args by default
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: false,
      }),
    });

    // Mock settings with showJobArgs false
    vi.spyOn($userSettings, "get").mockReturnValue({ showJobArgs: false });

    const { result } = renderHook(() => useSettings());
    expect(result.current.shouldShowJobArgs).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  $userSettings,
  clearAllSettings,
  clearShowJobArgs,
  setShowJobArgs,
} from "./settings";

// Mock local storage
const localStorageMock = {
  clear: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
};

global.localStorage = localStorageMock as unknown as Storage;

describe("settings store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSettings();
  });

  it("should initialize with empty settings", () => {
    expect($userSettings.get()).toEqual({});
  });

  it("should set show job args setting", () => {
    setShowJobArgs(true);
    expect($userSettings.get().showJobArgs).toBe(true);

    setShowJobArgs(false);
    expect($userSettings.get().showJobArgs).toBe(false);
  });

  it("should clear show job args setting", () => {
    setShowJobArgs(true);
    expect($userSettings.get().showJobArgs).toBe(true);

    clearShowJobArgs();
    expect($userSettings.get().showJobArgs).toBeUndefined();
  });

  it("should clear all settings", () => {
    setShowJobArgs(true);
    expect($userSettings.get().showJobArgs).toBe(true);

    clearAllSettings();
    expect($userSettings.get()).toEqual({});
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  $userSettings,
  clearAllSettings,
  clearShowJobArgs,
  setShowJobArgs,
} from "./settings";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllSettings();
  });

  it("should initialize with empty settings", () => {
    expect($userSettings.get()).toEqual({});
  });

  it("should set show job args setting", () => {
    setShowJobArgs(true);
    expect($userSettings.get().showJobArgs).toBe(true);
    expect(localStorage.getItem("river_ui_user_settings")).toBe(
      JSON.stringify({ showJobArgs: true }),
    );

    setShowJobArgs(false);
    expect($userSettings.get().showJobArgs).toBe(false);
    expect(localStorage.getItem("river_ui_user_settings")).toBe(
      JSON.stringify({ showJobArgs: false }),
    );
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

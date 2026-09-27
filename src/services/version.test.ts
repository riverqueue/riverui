import { describe, expect, it } from "vitest";

import { apiVersionToVersion } from "./version";

describe("apiVersionToVersion", () => {
  it("converts API version to frontend version", () => {
    const apiVersion = {
      go_version: "go1.26.7",
      modified: false,
      revision: "abc123def456",
      time: "2026-09-25T19:38:00Z",
      version: "(devel)",
    } as const;

    expect(apiVersionToVersion(apiVersion)).toEqual({
      goVersion: "go1.26.7",
      modified: false,
      revision: "abc123def456",
      time: "2026-09-25T19:38:00Z",
      version: "(devel)",
    });
  });
});

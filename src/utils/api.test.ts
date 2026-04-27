import { getWorkflow, getWorkflowKey } from "@services/workflows";
import { NotFoundError } from "@utils/api";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("API 404 handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("surfaces workflow not found messages from the current API envelope", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Workflow not found: missing-workflow.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      ),
    );

    await expect(
      getWorkflow({
        client: undefined as never,
        direction: "forward",
        meta: undefined,
        pageParam: undefined,
        queryKey: getWorkflowKey("missing-workflow"),
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new NotFoundError("Workflow not found: missing-workflow."),
    );
  });

  it("rejects successful API responses that return the app shell", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!doctype html><title>River</title>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 200,
      }),
    );

    await expect(
      getWorkflow({
        client: undefined as never,
        direction: "forward",
        meta: undefined,
        pageParam: undefined,
        queryKey: getWorkflowKey("wf-with-missing-api-route"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      message:
        "Expected JSON response from http://example.test/api/pro/workflows/wf-with-missing-api-route, received text/html; charset=utf-8.",
      status: 200,
    });
  });
});

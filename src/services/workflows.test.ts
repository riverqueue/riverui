import { getWorkflowTaskSignals } from "@services/workflows";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("workflows service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("parses task signal dates, ids, cursor ids, and scope metadata", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          has_more: true,
          next_cursor_id: "101",
          scope: {
            attempt: 3,
            scope: "current_attempt",
          },
          signals: [
            {
              attempt: 3,
              created_at: "2026-04-21T17:58:00Z",
              id: 102,
              key: "approval.received",
              payload: { decision: "approve" },
              source: { actor: "manager" },
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const signalList = await getWorkflowTaskSignals({
      cursorID: "99",
      key: "approval.received",
      scope: "current_attempt",
      taskName: "await/review",
      workflowID: "wf-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://example.test/api/pro/workflows/wf-123/task-signals?desc=true&limit=20&task_name=await%2Freview&key=approval.received&cursor_id=99&scope=current_attempt",
    );
    expect(signalList.hasMore).toBe(true);
    expect(signalList.nextCursorID).toBe(101n);
    expect(signalList.scope).toEqual({
      attempt: 3,
      scope: "current_attempt",
    });
    expect(signalList.signals).toHaveLength(1);
    expect(signalList.signals[0]).toMatchObject({
      attempt: 3,
      id: 102n,
      key: "approval.received",
      payload: { decision: "approve" },
      source: { actor: "manager" },
    });
    expect(signalList.signals[0]?.createdAt).toBeInstanceOf(Date);
    expect(signalList.signals[0]?.createdAt.toISOString()).toBe(
      "2026-04-21T17:58:00.000Z",
    );
  });
});

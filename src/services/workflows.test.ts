import {
  getWorkflowTaskSignals,
  getWorkflowTaskWaitDiagnostics,
} from "@services/workflows";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("workflows service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("parses task signal dates, ids, cursor ids, evidence, and scope", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          evidence: {
            evaluated_at: "2026-04-21T17:59:00Z",
            workflow_attempt: 3,
          },
          has_more: true,
          next_cursor_id: "101",
          scope: "history",
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
      scope: "history",
      taskName: "await/review",
      workflowID: "wf-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://example.test/api/pro/workflows/wf-123/task-signals?desc=true&limit=20&task_name=await%2Freview&key=approval.received&cursor_id=99&scope=history",
    );
    expect(signalList.hasMore).toBe(true);
    expect(signalList.nextCursorID).toBe(101n);
    expect(signalList.scope).toBe("history");
    expect(signalList.evidence?.workflowAttempt).toBe(3);
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

  it("omits the key query parameter when loading declared signal history", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          has_more: false,
          scope: "history",
          signals: [],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    await getWorkflowTaskSignals({
      scope: "history",
      taskName: "await/review",
      workflowID: "wf-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://example.test/api/pro/workflows/wf-123/task-signals?desc=true&limit=20&task_name=await%2Freview&scope=history",
    );
  });

  it("keeps absent cursors absent when a signal page has no more rows", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          has_more: false,
          scope: "history",
          signals: [],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const signalList = await getWorkflowTaskSignals({
      scope: "history",
      taskName: "await/review",
      workflowID: "wf-123",
    });

    expect(signalList.hasMore).toBe(false);
    expect(signalList.nextCursorID).toBeUndefined();
  });

  it("sends explicit attempt selectors for signal history", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          has_more: false,
          scope: "history",
          signals: [],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    await getWorkflowTaskSignals({
      scope: "history",
      taskName: "await/review",
      termName: "approval_received",
      workflowAttempt: 2,
      workflowID: "wf-123",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("workflow_attempt=2");
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "term_name=approval_received",
    );
  });

  it("parses current wait diagnostics", async () => {
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          eval_error: "undeclared input",
          expr_result: false,
          inputs: {
            deps: [
              {
                available: true,
                finalized_at: "2026-04-21T17:57:00Z",
                state: "completed",
                task_name: "build",
              },
            ],
            signals: [
              {
                included_count: 2,
                key: "approval.received",
                last_id: "9002",
              },
            ],
            timers: [
              {
                fire_at: "2026-04-21T18:10:00Z",
                fired: false,
                name: "review_sla",
              },
            ],
          },
          inspected_at: "2026-04-21T18:00:00Z",
          phase: "waiting",
          signal_scan_count: 10000,
          signal_scan_limit: 10000,
          terms: [
            {
              last_matched_id: "9001",
              matched_count: 1,
              name: "approval_received",
              required_count: 2,
              satisfied: false,
            },
          ],
          truncated: true,
          workflow_attempt: 4,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const diagnostics = await getWorkflowTaskWaitDiagnostics({
      taskName: "await/review",
      workflowID: "wf-123",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://example.test/api/pro/workflows/wf-123/task-wait-diagnostics?task_name=await%2Freview",
    );
    expect(diagnostics.evalError).toBe("undeclared input");
    expect(diagnostics.exprResult).toBe(false);
    expect(diagnostics.signalScanCount).toBe(10000);
    expect(diagnostics.signalScanLimit).toBe(10000);
    expect(diagnostics.truncated).toBe(true);
    expect(diagnostics.workflowAttempt).toBe(4);
    expect(diagnostics.inputs.deps[0]?.finalizedAt?.toISOString()).toBe(
      "2026-04-21T17:57:00.000Z",
    );
    expect(diagnostics.inputs.signals[0]).toMatchObject({
      includedCount: 2,
      key: "approval.received",
      lastID: 9002n,
    });
    expect(diagnostics.inputs.timers[0]?.fireAt?.toISOString()).toBe(
      "2026-04-21T18:10:00.000Z",
    );
    expect(diagnostics.terms[0]).toMatchObject({
      lastMatchedID: 9001n,
      matchedCount: 1,
      name: "approval_received",
      requiredCount: 2,
      satisfied: false,
    });
  });
});

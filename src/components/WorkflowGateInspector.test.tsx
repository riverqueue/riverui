import type { WorkflowTaskWait } from "@services/workflows";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { add } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkflowGateInspector, {
  type TaskWaitDiagnosticsLoader,
  type WaitFocusRequest,
} from "./WorkflowGateInspector";

describe("WorkflowGateInspector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T18:00:00Z"));
    document.body.innerHTML =
      '<script id="config__json">{"apiUrl":"http://example.test/api"}</script>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders summary, terms, signals, and timers from wait data", async () => {
    const wait: WorkflowTaskWait = {
      evidence: {
        evaluatedAt: new Date("2026-04-21T17:59:00Z"),
        workflowAttempt: 2,
      },
      exprCel: "approval_received || review_sla_timeout",
      inputs: {
        deps: [],
        signals: [
          {
            key: "approval.received",
            result: {
              includedCount: 1,
              lastIncludedID: 9001n,
            },
          },
        ],
        timers: [
          {
            afterSeconds: 1200,
            anchor: { kind: "wait_started_at" },
            fireAt: add(new Date("2026-04-21T17:50:00Z"), { minutes: 20 }),
            name: "review_sla_timeout",
            result: {
              fireAt: add(new Date("2026-04-21T17:50:00Z"), { minutes: 20 }),
              fired: false,
            },
          },
        ],
      },
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      startedAt: new Date("2026-04-21T17:50:00Z"),
      summary: "Human approval received",
      terms: [
        {
          exprCel: `payload.approved == true`,
          kind: "signal",
          label: "Human approval received",
          name: "approval_received",
          result: {
            lastMatchedID: 9001n,
            matchedCount: 1,
            requiredCount: 1,
            satisfied: true,
          },
          signalKey: "approval.received",
        },
        {
          kind: "timer",
          label: "Review SLA timeout reached",
          name: "review_sla_timeout",
          result: { matchedCount: 0, requiredCount: 0, satisfied: false },
          timerName: "review_sla_timeout",
        },
      ],
    };

    renderInspector(wait);

    expect(
      screen.getByText((_, element) =>
        Boolean(
          element?.textContent === "Resolved by: Human approval received.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Human approval received" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evaluated")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Human approval received" }),
      );
    });
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("1 of 2 conditions satisfied")).toBeInTheDocument();
    expect(screen.getByText("approval_received")).toBeInTheDocument();
    expect(screen.getByText("review_sla_timeout")).toBeInTheDocument();
    expect(screen.getAllByText("Human approval received")).not.toHaveLength(0);
    expect(screen.getAllByText("Review SLA timeout reached")).not.toHaveLength(
      0,
    );
    expect(screen.getAllByText("Signal")).not.toHaveLength(0);
    expect(screen.getAllByText("Timer")).not.toHaveLength(0);
    expect(screen.getByText("payload.approved == true")).toBeInTheDocument();
    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(screen.getByText("Last included")).toBeInTheDocument();
    expect(screen.getAllByText("#9001")).not.toHaveLength(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes("Satisfied by resolution")),
      ),
    ).not.toHaveLength(0);
    expect(screen.getByText("Fires")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes("20m after wait starts")),
      ),
    ).not.toHaveLength(0);
    expect(
      screen.getByRole("button", { name: /Resolution evidence/ }),
    ).toBeInTheDocument();
  });

  it("renders dependency and signal CEL terms", async () => {
    const wait: WorkflowTaskWait = {
      exprCel: "classify_intake_done && approval_received",
      inputs: {
        deps: [],
        signals: [],
        timers: [],
      },
      phase: "waiting",
      terms: [
        {
          exprCel: `deps["classify_intake"].output.category == "launch"`,
          kind: "generic",
          label: "Classify intake done",
          name: "classify_intake_done",
          result: { matchedCount: 0, requiredCount: 0, satisfied: true },
        },
        {
          exprCel: `payload.approved == true`,
          kind: "signal",
          label: "Approval received",
          name: "approval_received",
          result: { matchedCount: 0, requiredCount: 0, satisfied: false },
          signalKey: "approval.received",
        },
      ],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(screen.queryByText("Definition")).not.toBeInTheDocument();
    expect(
      screen.getByText(`deps["classify_intake"].output.category == "launch"`),
    ).toBeInTheDocument();
    expect(screen.getByText("payload.approved == true")).toBeInTheDocument();
  });

  it("uses phase-aware fallback copy when no summary is available", () => {
    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [],
        timers: [],
      },
      phase: "not_started",
      terms: [],
    };

    renderInspector(wait);

    expect(
      screen.getByText(
        "Wait has not started because dependencies are still incomplete.",
      ),
    ).toBeInTheDocument();
  });

  it("scrolls to a focused condition only once per focus request", async () => {
    vi.useRealTimers();

    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(focus);

    const wait: WorkflowTaskWait = {
      evidence: {
        evaluatedAt: new Date("2026-04-21T17:59:00Z"),
        workflowAttempt: 1,
      },
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [],
        timers: [],
      },
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      summary: "Human approval received",
      terms: [
        {
          kind: "signal",
          label: "Human approval received",
          name: "approval_received",
          result: { matchedCount: 0, requiredCount: 0, satisfied: true },
        },
      ],
    };
    const focusRequest: WaitFocusRequest = {
      conditionName: "approval_received",
      requestID: 1,
    };

    const { rerender } = renderInspector(wait, { focusRequest });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender(
        <WorkflowGateInspector
          focusRequest={focusRequest}
          taskName="task/alpha"
          wait={{
            ...wait,
            evidence: {
              evaluatedAt: new Date("2026-04-21T18:00:00Z"),
              workflowAttempt: 1,
            },
          }}
          workflowID="wf-123"
        />,
      );
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(
        <WorkflowGateInspector
          focusRequest={{ ...focusRequest, requestID: 2 }}
          taskName="task/alpha"
          wait={wait}
          workflowID="wf-123"
        />,
      );
    });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("fetches task signal signals lazily using the evidence scope when resolved", async () => {
    vi.useRealTimers();

    const fetchMock = mockTaskSignalsFetch([
      {
        body: {
          evidence: {
            evaluated_at: "2026-04-21T17:59:00Z",
            workflow_attempt: 2,
          },
          has_more: false,
          scope: "evidence",
          signals: [
            {
              attempt: 2,
              created_at: "2026-04-21T17:58:00Z",
              id: "9001",
              key: "approval.received",
              payload: { decision: "approve" },
              source: { actor: "manager" },
            },
          ],
        },
      },
    ]);

    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [
          {
            key: "approval.received",
          },
        ],
        timers: [],
      },
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      summary: "Human approval received",
      terms: [],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Resolution evidence/ }),
      );
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: /Resolution evidence/ }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("scope=evidence");
    expect(
      await screen.findByText("Signals included when this wait resolved."),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/decision/)).not.toHaveLength(0);
    expect(screen.getAllByText(/manager/)).not.toHaveLength(0);
  });

  it("uses history scope by default when still waiting", async () => {
    vi.useRealTimers();

    const fetchMock = mockTaskSignalsFetch([
      {
        body: {
          has_more: false,
          scope: "history",
          signals: [],
        },
      },
    ]);

    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [
          {
            key: "approval.received",
          },
        ],
        timers: [],
      },
      phase: "waiting",
      terms: [],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(screen.getByText("0 of 1 conditions satisfied")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Signal history/ }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("scope=history");
    expect(
      await screen.findByText(
        "No signals found in the current workflow attempt.",
      ),
    ).toBeInTheDocument();
  });

  it("shows diagnostics load failures instead of masking them", async () => {
    vi.useRealTimers();

    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [],
        timers: [],
      },
      phase: "waiting",
      terms: [],
    };

    renderInspector(wait, {
      loadTaskWaitDiagnostics: async () => {
        throw new Error(
          "Expected JSON response from /api/pro/workflows/wf-123/task-wait-diagnostics, received text/html; charset=utf-8.",
        );
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(
      await screen.findByText(
        "Unable to load waiting diagnostics: Expected JSON response from /api/pro/workflows/wf-123/task-wait-diagnostics, received text/html; charset=utf-8.",
      ),
    ).toBeInTheDocument();
  });

  it("shows when signal diagnostics are truncated", async () => {
    vi.useRealTimers();

    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      inputs: {
        deps: [],
        signals: [{ key: "approval.received" }],
        timers: [],
      },
      phase: "waiting",
      terms: [],
    };

    renderInspector(wait, {
      loadTaskWaitDiagnostics: async () => ({
        exprResult: false,
        inputs: {
          deps: [],
          signals: [
            {
              includedCount: 10000,
              key: "approval.received",
              lastID: 9001n,
            },
          ],
          timers: [],
        },
        inspectedAt: new Date("2026-04-21T18:00:00Z"),
        phase: "waiting",
        signalScanCount: 10000,
        signalScanLimit: 10000,
        terms: [],
        truncated: true,
        workflowAttempt: 1,
      }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(await screen.findByText("10,000 / 10,000")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Signal diagnostics reached the scan limit, so expression and match counts are best effort.",
      ),
    ).toBeInTheDocument();
  });

  it("explains unavailable dependency outputs before a wait starts", async () => {
    vi.useRealTimers();

    const wait: WorkflowTaskWait = {
      exprCel: "draft_ready_to_send",
      inputs: {
        deps: [{ taskName: "verify_draft" }],
        signals: [],
        timers: [],
      },
      phase: "not_started",
      terms: [
        {
          exprCel: `deps["verify_draft"].output.needs_human_review == false`,
          kind: "generic",
          label: "draft ready to send",
          name: "draft_ready_to_send",
        },
      ],
    };

    renderInspector(wait, {
      loadTaskWaitDiagnostics: async () => ({
        evalError: "no such key: needs_human_review",
        inputs: {
          deps: [
            {
              available: false,
              state: "pending",
              taskName: "verify_draft",
            },
          ],
          signals: [],
          timers: [],
        },
        inspectedAt: new Date("2026-04-21T18:00:00Z"),
        phase: "not_started",
        signalScanCount: 0,
        signalScanLimit: 10000,
        terms: [],
        truncated: false,
        workflowAttempt: 1,
      }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(
      await screen.findByText("Waiting for dependency output."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("no such key: needs_human_review"),
    ).not.toBeInTheDocument();
  });
});

const renderInspector = (
  wait: WorkflowTaskWait,
  props: {
    focusRequest?: WaitFocusRequest;
    loadTaskWaitDiagnostics?: TaskWaitDiagnosticsLoader;
  } = {},
) => {
  return render(
    <WorkflowGateInspector
      focusRequest={props.focusRequest}
      loadTaskWaitDiagnostics={
        props.loadTaskWaitDiagnostics ??
        (async () => ({
          inputs: {
            deps: [],
            signals: [],
            timers: [],
          },
          inspectedAt: new Date("2026-04-21T18:00:00Z"),
          phase: wait.phase,
          signalScanCount: 0,
          signalScanLimit: 10000,
          terms: [],
          truncated: false,
          workflowAttempt: 1,
        }))
      }
      taskName="task/alpha"
      wait={wait}
      workflowID="wf-123"
    />,
  );
};

const mockTaskSignalsFetch = (
  responses: Array<{
    body: unknown;
    status?: number;
  }>,
) => {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const nextResponse = responses.shift();
    if (!nextResponse) {
      throw new Error("Unexpected fetch call");
    }

    return new Response(JSON.stringify(nextResponse.body), {
      headers: { "Content-Type": "application/json" },
      status: nextResponse.status ?? 200,
    });
  });
};

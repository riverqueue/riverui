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
      asOf: new Date("2026-04-21T17:59:00Z"),
      attempt: 2,
      exprCel: "approval_received || review_sla_timeout_reached",
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      signals: [
        {
          key: "approval.received",
          lastMatchedID: 9001n,
          lastVisibleID: 9001n,
          matched: true,
          matchedCount: 1,
          visibleCount: 1,
        },
      ],
      startedAt: new Date("2026-04-21T17:50:00Z"),
      summary: "Human approval received",
      terms: [
        {
          exprCel: `payload.approved == true`,
          kind: "signal",
          label: "Human approval received",
          matched: true,
          name: "approval_received",
        },
        {
          kind: "timer",
          label: "Review SLA timeout reached",
          matched: false,
          name: "review_sla_timeout_reached",
        },
      ],
      timers: [
        {
          afterSeconds: 1200,
          anchor: { kind: "wait_started_at" },
          fireAt: add(new Date("2026-04-21T17:50:00Z"), { minutes: 20 }),
          fired: false,
          matched: false,
          name: "review_sla_timeout",
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
    expect(screen.getByText("1 of 2 conditions matched")).toBeInTheDocument();
    expect(screen.getByText("approval_received")).toBeInTheDocument();
    expect(screen.getByText("review_sla_timeout_reached")).toBeInTheDocument();
    expect(screen.getAllByText("Human approval received")).not.toHaveLength(0);
    expect(screen.getAllByText("Review SLA timeout reached")).not.toHaveLength(
      0,
    );
    expect(screen.getAllByText("Signal")).not.toHaveLength(0);
    expect(screen.getAllByText("Timer")).not.toHaveLength(0);
    expect(screen.getByText("payload.approved == true")).toBeInTheDocument();
    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.getByText("Last visible")).toBeInTheDocument();
    expect(screen.getAllByText("#9001")).not.toHaveLength(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes("Matched by resolution")),
      ),
    ).not.toHaveLength(0);
    expect(screen.getByText("Fires")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes("delay +20m")),
      ),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes("anchor wait started")),
      ),
    ).not.toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "View signals" }),
    ).toBeInTheDocument();
  });

  it("renders dependency and signal CEL terms", async () => {
    const wait: WorkflowTaskWait = {
      exprCel: "classify_intake_done && approval_received",
      phase: "waiting",
      signals: [],
      terms: [
        {
          exprCel: `output.category == "launch"`,
          kind: "dependency_output",
          label: "Classify intake done",
          matched: true,
          name: "classify_intake_done",
        },
        {
          exprCel: `payload.approved == true`,
          kind: "signal",
          label: "Approval received",
          matched: false,
          name: "approval_received",
        },
      ],
      timers: [],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(screen.queryByText("Definition")).not.toBeInTheDocument();
    expect(screen.getByText(`output.category == "launch"`)).toBeInTheDocument();
    expect(screen.getByText("payload.approved == true")).toBeInTheDocument();
  });

  it("uses phase-aware fallback copy when no summary is available", () => {
    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      phase: "not_started",
      signals: [],
      terms: [],
      timers: [],
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
      asOf: new Date("2026-04-21T17:59:00Z"),
      exprCel: "approval_received",
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      signals: [],
      summary: "Human approval received",
      terms: [
        {
          kind: "signal",
          label: "Human approval received",
          matched: true,
          name: "approval_received",
        },
      ],
      timers: [],
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
            asOf: new Date("2026-04-21T18:00:00Z"),
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

  it("fetches task-visible signals lazily using the wait-result scope when resolved", async () => {
    vi.useRealTimers();

    const fetchMock = mockTaskSignalsFetch([
      {
        body: {
          has_more: false,
          scope: {
            attempt: 2,
            scope: "at_wait_result",
          },
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
      phase: "resolved",
      resolvedAt: new Date("2026-04-21T17:59:00Z"),
      signals: [
        {
          key: "approval.received",
          matched: true,
          matchedCount: 1,
          visibleCount: 1,
        },
      ],
      summary: "Human approval received",
      terms: [],
      timers: [],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View signals" }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Hide signals" }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("scope=at_wait_result");
    expect(
      await screen.findByText(
        "Showing signals visible at the wait result for attempt 2.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/decision/)).not.toHaveLength(0);
    expect(screen.getAllByText(/manager/)).not.toHaveLength(0);
  });

  it("uses current-attempt scope by default when still waiting", async () => {
    vi.useRealTimers();

    const fetchMock = mockTaskSignalsFetch([
      {
        body: {
          has_more: false,
          scope: {
            attempt: 3,
            scope: "current_attempt",
          },
          signals: [],
        },
      },
    ]);

    const wait: WorkflowTaskWait = {
      exprCel: "approval_received",
      phase: "waiting",
      signals: [
        {
          key: "approval.received",
          matched: false,
          matchedCount: 0,
          visibleCount: 0,
        },
      ],
      terms: [],
      timers: [],
    };

    renderInspector(wait);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });

    expect(screen.getByText("0 of 1 conditions matched")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View signals" }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("scope=current_attempt");
    expect(
      await screen.findByText(
        "Showing signals from the current visible rows for attempt 3.",
      ),
    ).toBeInTheDocument();
  });
});

const renderInspector = (
  wait: WorkflowTaskWait,
  props: {
    focusRequest?: WaitFocusRequest;
  } = {},
) => {
  return render(
    <WorkflowGateInspector
      focusRequest={props.focusRequest}
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

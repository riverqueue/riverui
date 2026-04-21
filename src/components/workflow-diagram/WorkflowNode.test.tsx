import type { Node, NodeProps } from "@xyflow/react";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";

vi.mock("@xyflow/react", () => ({
  Handle: ({
    style,
    type,
  }: {
    style?: { top?: number | string };
    type?: "source" | "target";
  }) => (
    <div
      data-testid={type === "source" ? "source-handle" : "target-handle"}
      data-top={String(style?.top)}
    />
  ),
  Position: {
    Left: "left",
    Right: "right",
  },
  useUpdateNodeInternals: () => vi.fn(),
}));

vi.mock("react-time-sync", () => ({
  useTime: () => 1000,
}));

const buildNodeProps = (
  data: WorkflowNodeData,
): NodeProps<Node<WorkflowNodeData, "workflow">> => {
  type WorkflowNodeType = Node<WorkflowNodeData, "workflow">;

  const props: NodeProps<WorkflowNodeType> = {
    data,
    deletable: false,
    draggable: false,
    dragging: false,
    id: data.job.id.toString(),
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    selectable: true,
    selected: false,
    type: "workflow",
    zIndex: 0,
  };

  return props;
};

const renderNode = (data: WorkflowNodeData) => {
  const props = buildNodeProps(data);
  return render(<WorkflowNode {...props} />);
};

const getGateLever = (container: HTMLElement): SVGSVGElement => {
  const lever = container.querySelector("[data-test-workflow-gate-lever]");
  if (!(lever instanceof SVGSVGElement)) {
    throw new Error("Expected workflow gate lever svg");
  }

  return lever;
};

const getNodeCard = (container: HTMLElement): HTMLDivElement => {
  const card = container.querySelector(
    "div.overflow-hidden.rounded-xl.border-2",
  );
  if (!(card instanceof HTMLDivElement)) {
    throw new Error("Expected workflow node card div");
  }

  return card;
};

const buildGateData = ({
  id,
  phase,
}: {
  id: number;
  phase: "inactive" | "satisfied" | "unknown" | "waiting";
}): WorkflowNodeData => {
  const satisfied = phase === "satisfied";
  const job = workflowJobFactory.build({
    gate: {
      declaredSignals: [],
      enabled: true,
      exprCel: 'signals["approval"].size() > 0',
      phase,
      satisfiedAt: satisfied ? new Date("2026-01-01T00:45:00.000Z") : undefined,
      timers: [],
    },
    id,
    state: satisfied ? JobState.Completed : JobState.Pending,
    task: "compose_draft_response",
    waitReason: satisfied ? "none" : "gate",
  });

  return {
    hasDownstreamDeps: false,
    hasUpstreamDeps: true,
    job,
    waitReason: satisfied ? "none" : "gate",
  };
};

describe("WorkflowNode wait reason indicators", () => {
  it("keeps the standard pending icon for dependency-blocked pending tasks", () => {
    const job = workflowJobFactory.build({
      deps: ["classify_intake"],
      id: 2,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "dependencies",
    });

    renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: true,
      job,
      waitReason: "dependencies",
    });

    expect(screen.queryByTestId("gate-row")).toBeNull();
    expect(screen.queryByText("–")).toBeNull();
  });

  it("renders a circuit switch handle for gate-blocked pending tasks", () => {
    const job = workflowJobFactory.build({
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: 'signals["approval"].size() > 0',
        phase: "waiting",
        timers: [],
      },
      id: 1,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "gate",
    });

    renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: true,
      job,
      waitReason: "gate",
    });

    expect(screen.getByTitle("Gate pending")).toBeInTheDocument();
    expect(screen.queryByTestId("gate-row")).toBeNull();
    expect(screen.queryByText("–")).toBeNull();
  });

  it("selects the task when the node card is clicked", () => {
    const onSelect = vi.fn();
    const job = workflowJobFactory.build({
      id: 99,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "none",
    });

    const { container } = renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: false,
      job,
      onSelect,
      waitReason: "none",
    });

    const wrapper = getNodeCard(container).parentElement;
    if (!(wrapper instanceof HTMLDivElement)) {
      throw new Error("Expected workflow node wrapper div");
    }

    fireEvent.pointerDown(wrapper);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects the task when the card body receives pointer input", () => {
    const onSelect = vi.fn();
    const job = workflowJobFactory.build({
      id: 100,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "none",
    });

    const { container } = renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: false,
      job,
      onSelect,
      waitReason: "none",
    });

    fireEvent.pointerDown(getNodeCard(container));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders a circuit switch handle when both deps and gate are blocking", () => {
    const job = workflowJobFactory.build({
      deps: ["classify_intake"],
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: 'signals["approval"].size() > 0',
        phase: "waiting",
        timers: [],
      },
      id: 3,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "dependencies_and_gate",
    });

    renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: true,
      job,
      waitReason: "dependencies_and_gate",
    });

    expect(screen.getByTitle("Gate pending")).toBeInTheDocument();
    expect(screen.queryByTestId("gate-row")).toBeNull();
  });

  it("shows duration when running and no gate accent", () => {
    const job = workflowJobFactory.build({
      id: 4,
      state: JobState.Running,
      task: "compose_draft_response",
      waitReason: "none",
    });
    job.attemptedAt = new Date((1000 - 5) * 1000);

    renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: true,
      job,
      waitReason: "none",
    });

    expect(screen.queryByTestId("gate-row")).toBeNull();
    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("keeps handles vertically centered even with a gate", () => {
    const job = workflowJobFactory.build({
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: 'signals["approval"].size() > 0',
        phase: "waiting",
        timers: [],
      },
      id: 6,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "gate",
    });

    renderNode({
      hasDownstreamDeps: true,
      hasUpstreamDeps: true,
      job,
      waitReason: "gate",
    });

    expect(screen.getByTestId("source-handle")).toHaveAttribute(
      "data-top",
      "50%",
    );
    expect(screen.getByTestId("target-handle")).toHaveAttribute(
      "data-top",
      "50%",
    );
  });

  it("renders a satisfied circuit switch handle for tasks with non-blocking gates", () => {
    const job = workflowJobFactory.build({
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: 'signals["approval"].size() > 0',
        phase: "satisfied",
        satisfiedAt: new Date("2026-01-01T00:45:00.000Z"),
        timers: [],
      },
      id: 5,
      state: JobState.Available,
      task: "compose_draft_response",
      waitReason: "none",
    });

    renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: true,
      job,
      waitReason: "none",
    });

    expect(screen.getByTitle("Gate satisfied")).toBeInTheDocument();
    expect(screen.queryByTestId("gate-row")).toBeNull();
  });

  it("renders inactive gates with an open lever until they are satisfied", () => {
    const { container } = renderNode(
      buildGateData({ id: 17, phase: "inactive" }),
    );

    expect(screen.getByTitle("Gate inactive")).toBeInTheDocument();
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-phase",
      "inactive",
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-lever",
      "open",
    );
  });

  it.each([
    {
      dark: "dark:border-blue-700",
      expected: "border-blue-300",
      state: JobState.Available,
    },
    {
      dark: "dark:border-slate-700",
      expected: "border-slate-200",
      state: JobState.Pending,
    },
    {
      dark: "dark:border-blue-700",
      expected: "border-blue-300",
      state: JobState.Running,
    },
    {
      dark: "dark:border-slate-700",
      expected: "border-slate-200",
      state: JobState.Completed,
    },
    {
      dark: "dark:border-amber-700",
      expected: "border-amber-300",
      state: JobState.Retryable,
    },
    {
      dark: "dark:border-red-800",
      expected: "border-red-300",
      state: JobState.Cancelled,
    },
  ])("applies state border classes for $state", ({ dark, expected, state }) => {
    const job = workflowJobFactory.build({
      id: 100 + Object.values(JobState).indexOf(state),
      state,
      task: `task-${state}`,
    });

    const { container } = renderNode({
      hasDownstreamDeps: false,
      hasUpstreamDeps: false,
      job,
      waitReason: "none",
    });

    expect(getNodeCard(container)).toHaveClass(expected, dark);
  });
});

describe("WorkflowNode gate flash animation", () => {
  it("does not apply a gate flash attribute on initial mount", () => {
    const data = buildGateData({ id: 11, phase: "waiting" });
    const { container } = renderNode(data);

    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-transitioning",
      "false",
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-phase",
      "waiting",
    );
  });

  it("applies a closed flash on waiting to satisfied transitions", async () => {
    const { container, rerender } = renderNode(
      buildGateData({ id: 12, phase: "waiting" }),
    );

    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 12, phase: "satisfied" }))}
      />,
    );

    await waitFor(() =>
      expect(getGateLever(container)).toHaveAttribute(
        "data-test-workflow-gate-transitioning",
        "true",
      ),
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-lever",
      "closed",
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-phase",
      "satisfied",
    );
  });

  it("applies an open flash on satisfied to waiting transitions", async () => {
    const { container, rerender } = renderNode(
      buildGateData({ id: 13, phase: "satisfied" }),
    );

    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 13, phase: "waiting" }))}
      />,
    );

    await waitFor(() =>
      expect(getGateLever(container)).toHaveAttribute(
        "data-test-workflow-gate-transitioning",
        "true",
      ),
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-lever",
      "open",
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-phase",
      "waiting",
    );
  });

  it("keeps inactive transitions neutral without replaying a gate flash", async () => {
    const { container, rerender } = renderNode(
      buildGateData({ id: 14, phase: "waiting" }),
    );

    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 14, phase: "inactive" }))}
      />,
    );

    await waitFor(() =>
      expect(getGateLever(container)).toHaveAttribute(
        "data-test-workflow-gate-phase",
        "inactive",
      ),
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-transitioning",
      "false",
    );
  });

  it("replays from unknown to satisfied and clears the flash on animation end", async () => {
    const { container, rerender } = renderNode(
      buildGateData({ id: 15, phase: "unknown" }),
    );

    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 15, phase: "satisfied" }))}
      />,
    );

    await waitFor(() =>
      expect(getGateLever(container)).toHaveAttribute(
        "data-test-workflow-gate-transitioning",
        "true",
      ),
    );

    getGateLever(container).dispatchEvent(new Event("animationend"));
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-transitioning",
      "false",
    );
  });

  it("handles rapid phase changes without leaving stale flash state", async () => {
    const { container, rerender } = renderNode(
      buildGateData({ id: 16, phase: "waiting" }),
    );

    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 16, phase: "satisfied" }))}
      />,
    );
    rerender(
      <WorkflowNode
        {...buildNodeProps(buildGateData({ id: 16, phase: "inactive" }))}
      />,
    );

    await waitFor(() =>
      expect(getGateLever(container)).toHaveAttribute(
        "data-test-workflow-gate-phase",
        "inactive",
      ),
    );
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-transitioning",
      "false",
    );

    getGateLever(container).dispatchEvent(new Event("animationend"));
    expect(getGateLever(container)).toHaveAttribute(
      "data-test-workflow-gate-transitioning",
      "false",
    );
  });
});

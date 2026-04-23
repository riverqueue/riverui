import type { Node, NodeProps } from "@xyflow/react";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { render, screen } from "@testing-library/react";
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
): NodeProps<Node<WorkflowNodeData, "workflow">> => ({
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
});

const renderNode = (data: WorkflowNodeData) => {
  return render(<WorkflowNode {...buildNodeProps(data)} />);
};

const buildWaitConditionData = ({
  id,
  phase,
}: {
  id: number;
  phase: "not_started" | "resolved" | "unknown" | "waiting";
}): WorkflowNodeData => {
  const resolved = phase === "resolved";
  const job = workflowJobFactory.build({
    id,
    state: resolved ? JobState.Completed : JobState.Pending,
    task: "compose_draft_response",
    wait: {
      exprCel: "approval_received",
      phase,
      signals: [
        {
          key: "approval",
          matched: resolved,
          matchedCount: resolved ? 1 : 0,
          visibleCount: resolved ? 1 : 0,
        },
      ],
      summary: resolved ? "Human approval received" : undefined,
      terms: [],
      timers: [],
    },
    waitReason: resolved ? "none" : "wait_condition",
  });

  return {
    hasDownstreamDeps: false,
    hasUpstreamDeps: true,
    job,
    waitReason: resolved ? "none" : "wait_condition",
  };
};

describe("WorkflowNode", () => {
  it("renders a physical gate handle for tasks with wait conditions", () => {
    const { container } = renderNode(
      buildWaitConditionData({ id: 11, phase: "waiting" }),
    );

    const lever = container.querySelector("[data-test-workflow-gate-lever]");
    expect(lever).not.toBeNull();
    expect(lever?.getAttribute("data-test-workflow-gate-lever")).toBe("open");
    expect(lever?.getAttribute("data-test-workflow-gate-phase")).toBe(
      "waiting",
    );
  });

  it("opens the gate when the wait condition is resolved", () => {
    const { container } = renderNode(
      buildWaitConditionData({ id: 12, phase: "resolved" }),
    );

    const lever = container.querySelector("[data-test-workflow-gate-lever]");
    expect(lever?.getAttribute("data-test-workflow-gate-lever")).toBe("closed");
    expect(lever?.getAttribute("data-test-workflow-gate-phase")).toBe(
      "resolved",
    );
  });

  it("renders plain pending nodes without wait-condition UI", () => {
    const job = workflowJobFactory.build({
      deps: ["classify_intake"],
      id: 13,
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

    expect(screen.queryByTestId("wait-condition-row")).toBeNull();
    expect(screen.queryByTestId("target-handle")).toBeInTheDocument();
  });

  it("uses the wait-condition summary in the gate tooltip when available", () => {
    const { container } = renderNode(
      buildWaitConditionData({ id: 14, phase: "resolved" }),
    );

    const tooltipTarget = container.querySelector(
      '[title*="Human approval received"]',
    );
    expect(tooltipTarget).not.toBeNull();
  });
});

import type { PropsWithChildren } from "react";

import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkflowDiagram from "./WorkflowDiagram";
import * as workflowDiagramLayout from "./workflowDiagramLayout";

const baseDate = new Date("2025-01-01T00:00:00.000Z");

const workflowJob = ({
  deps = [],
  id,
  state = JobState.Available,
  task,
  workflowID = "wf-1",
}: {
  deps?: string[];
  id: number;
  state?: JobState;
  task: string;
  workflowID?: string;
}): JobWithKnownMetadata => ({
  args: {},
  attempt: 0,
  attemptedAt: undefined,
  attemptedBy: [],
  createdAt: baseDate,
  errors: [],
  finalizedAt: undefined,
  id: BigInt(id),
  kind: `job-${task}`,
  logs: {},
  maxAttempts: 1,
  metadata: {
    deps,
    task,
    workflow_id: workflowID,
    workflow_staged_at: baseDate.toISOString(),
  },
  priority: 1,
  queue: "default",
  scheduledAt: baseDate,
  state,
  tags: [],
});

type MockReactFlowProps = PropsWithChildren<{
  edges: unknown[];
  nodes: unknown[];
  onNodesChange?: (changes: SelectionChange[]) => void;
}>;

type SelectionChange = {
  id: string;
  selected: boolean;
  type: "select";
};

let currentTheme: "dark" | "light" = "light";
let latestReactFlowProps: MockReactFlowProps | undefined;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: currentTheme }),
}));

vi.mock("./WorkflowNode", () => ({
  default: () => null,
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: () => null,
  MiniMap: () => <div data-testid="mini-map" />,
  ReactFlow: (props: MockReactFlowProps) => {
    latestReactFlowProps = props;

    return (
      <div data-testid="react-flow">
        <div data-testid="edge-count">{props.edges.length}</div>
        <div data-testid="node-count">{props.nodes.length}</div>
        {props.children}
      </div>
    );
  },
}));

describe("WorkflowDiagram", () => {
  beforeEach(() => {
    currentTheme = "light";
    latestReactFlowProps = undefined;
    vi.restoreAllMocks();
  });

  it("renders nodes and edges for a workflow", () => {
    const tasks = [
      workflowJob({ id: 1, task: "a" }),
      workflowJob({ deps: ["a"], id: 2, task: "b" }),
      workflowJob({ deps: ["a", "b"], id: 3, task: "c" }),
    ];

    render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.getByTestId("node-count")).toHaveTextContent("3");
    expect(screen.getByTestId("edge-count")).toHaveTextContent("3");
  });

  it("calls setSelectedJobId when a node is selected", () => {
    const tasks = [
      workflowJob({ id: 1, task: "a" }),
      workflowJob({ deps: ["a"], id: 2, task: "b" }),
    ];

    const setSelectedJobID = vi.fn();

    render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={setSelectedJobID}
        tasks={tasks}
      />,
    );

    expect(latestReactFlowProps).toBeDefined();

    act(() => {
      latestReactFlowProps?.onNodesChange?.([
        { id: "2", selected: true, type: "select" },
      ]);
    });

    expect(setSelectedJobID).toHaveBeenCalledWith(2n);
  });

  it("does not rerun layout when only selectedJobId changes", () => {
    const tasks = [
      workflowJob({ id: 1, task: "a" }),
      workflowJob({ deps: ["a"], id: 2, task: "b" }),
    ];
    const layoutSpy = vi.spyOn(workflowDiagramLayout, "getLayoutedElements");

    const { rerender } = render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    expect(layoutSpy).toHaveBeenCalledTimes(1);

    rerender(
      <WorkflowDiagram
        selectedJobId={2n}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    expect(layoutSpy).toHaveBeenCalledTimes(1);
  });

  it("does not rerun layout when only theme changes", () => {
    const tasks = [
      workflowJob({ id: 1, task: "a" }),
      workflowJob({ deps: ["a"], id: 2, task: "b" }),
    ];
    const layoutSpy = vi.spyOn(workflowDiagramLayout, "getLayoutedElements");

    const { rerender } = render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    expect(layoutSpy).toHaveBeenCalledTimes(1);

    currentTheme = "dark";

    rerender(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    expect(layoutSpy).toHaveBeenCalledTimes(1);
  });

  it("renders when metadata.deps is missing on a task", () => {
    const malformedJob = workflowJob({ id: 1, task: "a" });
    (
      malformedJob.metadata as unknown as {
        deps?: string[];
      }
    ).deps = undefined;

    render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={[malformedJob]}
      />,
    );

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.getByTestId("node-count")).toHaveTextContent("1");
    expect(screen.getByTestId("edge-count")).toHaveTextContent("0");
  });
});

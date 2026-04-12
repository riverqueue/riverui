import type { PropsWithChildren } from "react";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkflowDiagram from "./WorkflowDiagram";
import * as workflowDiagramLayout from "./workflowDiagramLayout";

type MiniMapNodeLike = {
  data?: {
    job?: {
      state?: JobState;
    };
  };
};

type MockEdge = {
  style?: {
    stroke?: string;
  };
};

type MockMiniMapProps = {
  nodeClassName?: (node: MiniMapNodeLike) => string;
};

type MockReactFlowProps = PropsWithChildren<{
  edges: MockEdge[];
  fitViewOptions?: {
    minZoom?: number;
    padding?: number;
  };
  minZoom?: number;
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
let latestMiniMapProps: MockMiniMapProps | undefined;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: currentTheme }),
}));

vi.mock("./WorkflowNode", () => ({
  default: () => null,
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: () => null,
  Controls: () => <div data-testid="diagram-controls" />,
  MiniMap: (props: MockMiniMapProps) => {
    latestMiniMapProps = props;
    return <div data-testid="mini-map" />;
  },
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
    latestMiniMapProps = undefined;
    vi.restoreAllMocks();
  });

  it("renders nodes and edges for a workflow", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "a" }),
      workflowJobFactory.build({ deps: ["a"], id: 2, task: "b" }),
      workflowJobFactory.build({ deps: ["a", "b"], id: 3, task: "c" }),
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
    expect(screen.getByTestId("diagram-controls")).toBeInTheDocument();
    expect(latestReactFlowProps?.minZoom).toBe(0.2);
    expect(latestReactFlowProps?.fitViewOptions?.minZoom).toBe(0.55);
  });

  it("calls setSelectedJobId when a node is selected", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "a" }),
      workflowJobFactory.build({ deps: ["a"], id: 2, task: "b" }),
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
      workflowJobFactory.build({ id: 1, task: "a" }),
      workflowJobFactory.build({ deps: ["a"], id: 2, task: "b" }),
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
      workflowJobFactory.build({ id: 1, task: "a" }),
      workflowJobFactory.build({ deps: ["a"], id: 2, task: "b" }),
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

  it("renders when deps is missing on a task", () => {
    const malformedJob = workflowJobFactory.build({ id: 1, task: "a" });
    (malformedJob as unknown as { deps?: string[] }).deps = undefined;

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

  it("uses the success edge color token for unblocked dependencies", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, state: JobState.Completed, task: "a" }),
      workflowJobFactory.build({
        deps: ["a"],
        id: 2,
        state: JobState.Pending,
        task: "b",
        waitReason: "dependencies",
      }),
    ];

    const { rerender } = render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    const lightEdge = latestReactFlowProps?.edges[0]?.style?.stroke;
    expect(lightEdge).toBe("var(--workflow-diagram-edge-success)");

    currentTheme = "dark";

    rerender(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    const darkEdge = latestReactFlowProps?.edges[0]?.style?.stroke;
    expect(darkEdge).toBe("var(--workflow-diagram-edge-success)");
  });

  it("uses the failed edge color token for failed dependencies", () => {
    const tasks = [
      workflowJobFactory.build({
        id: 1,
        state: JobState.Cancelled,
        task: "failed-source",
      }),
      workflowJobFactory.build({
        deps: ["failed-source"],
        id: 2,
        state: JobState.Pending,
        task: "dependent",
        waitReason: "dependencies",
      }),
    ];

    render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    const edgeStroke = latestReactFlowProps?.edges[0]?.style?.stroke;
    expect(edgeStroke).toBe("var(--workflow-diagram-edge-failed)");
  });

  it("maps minimap node classes to the updated status palette", () => {
    const tasks = [workflowJobFactory.build({ id: 1, task: "seed" })];

    render(
      <WorkflowDiagram
        selectedJobId={undefined}
        setSelectedJobId={vi.fn()}
        tasks={tasks}
      />,
    );

    const nodeClassName = latestMiniMapProps?.nodeClassName;
    expect(nodeClassName).toBeDefined();
    if (!nodeClassName) return;

    expect(
      nodeClassName({ data: { job: { state: JobState.Available } } }),
    ).toBe(
      "fill-blue-300/60 stroke-blue-500/60 dark:fill-blue-700/50 dark:stroke-blue-400/50 stroke-1",
    );
    expect(nodeClassName({ data: { job: { state: JobState.Running } } })).toBe(
      "fill-blue-300/60 stroke-blue-500/60 dark:fill-blue-700/50 dark:stroke-blue-400/50 stroke-1",
    );
    expect(nodeClassName({ data: { job: { state: JobState.Pending } } })).toBe(
      "fill-slate-300/60 stroke-slate-600/60 dark:fill-slate-700/50 dark:stroke-slate-400/50 stroke-1",
    );
    expect(
      nodeClassName({ data: { job: { state: JobState.Scheduled } } }),
    ).toBe(
      "fill-slate-300/60 stroke-slate-600/60 dark:fill-slate-700/50 dark:stroke-slate-400/50 stroke-1",
    );
    expect(
      nodeClassName({ data: { job: { state: JobState.Retryable } } }),
    ).toBe(
      "fill-amber-300/60 stroke-amber-500/60 dark:fill-amber-700/50 dark:stroke-amber-400/50 stroke-1",
    );
  });
});

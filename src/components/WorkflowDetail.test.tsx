import type { Features } from "@services/features";
import type { Workflow } from "@services/workflows";

import { FeaturesContext } from "@contexts/Features";
import { JobState } from "@services/types";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import WorkflowDetail from "./WorkflowDetail";

vi.mock("@components/workflow-diagram/WorkflowDiagram", () => ({
  default: ({
    setSelectedJobId,
    tasks,
  }: {
    setSelectedJobId: (jobId: bigint | undefined) => void;
    tasks: Array<{ id: bigint; name: string }>;
  }) => (
    <div data-testid="workflow-diagram">
      {tasks.map((task) => (
        <button
          key={task.id.toString()}
          onClick={() => setSelectedJobId(task.id)}
          type="button"
        >
          Select {task.name}
        </button>
      ))}
    </div>
  ),
}));

const features: Features = {
  durablePeriodicJobs: false,
  hasClientTable: false,
  hasProducerTable: true,
  hasSequenceTable: false,
  hasWorkflows: true,
  jobListHideArgsByDefault: false,
  producerQueries: true,
  workflowQueries: true,
};

const renderWorkflowDetail = async (
  workflow: Workflow,
  selectedJobId: bigint | undefined,
) => {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  const jobsRoute = createRoute({
    component: () => <div>Job route</div>,
    getParentRoute: () => rootRoute,
    path: "/jobs/$jobId",
  });

  const workflowRoute = createRoute({
    component: () => (
      <FeaturesContext.Provider value={{ features }}>
        <WorkflowDetail
          loading={false}
          selectedJobId={selectedJobId}
          setSelectedJobId={vi.fn()}
          workflow={workflow}
        />
      </FeaturesContext.Provider>
    ),
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const routeTree = rootRoute.addChildren([workflowRoute, jobsRoute]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree,
  });

  let rendered: ReturnType<typeof render> | undefined;
  await act(async () => {
    await router.load();
    rendered = render(<RouterProvider router={router} />);
  });

  return rendered!;
};

describe("WorkflowDetail gate inspector", () => {
  it("shows structured gate details in selected task inspector", async () => {
    const dependency = workflowJobFactory.build({
      id: 1,
      state: JobState.Completed,
      task: "classify_intake",
      waitReason: "none",
    });
    const gatedTask = workflowJobFactory.build({
      deps: ["classify_intake"],
      gate: {
        declaredSignals: ["approval.received"],
        enabled: true,
        exprCel: 'signals["approval.received"].size() > 0',
        phase: "waiting",
        timers: [
          {
            hasAfter: false,
            hasFireAt: false,
            name: "escalation",
          },
        ],
      },
      id: 2,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "gate",
    });

    await renderWorkflowDetail(
      {
        id: "wf-test-gate",
        name: "Workflow Test",
        tasks: [dependency, gatedTask],
      },
      gatedTask.id,
    );

    expect(screen.getByText("Gate")).toBeInTheDocument();
    expect(screen.getAllByText("Gate pending")).not.toHaveLength(0);
    expect(
      screen.getByText("Not yet staged, waiting on gate"),
    ).toBeInTheDocument();
    expect(screen.getByText("approval.received")).toBeInTheDocument();
    expect(screen.getByText("escalation")).toBeInTheDocument();
    expect(screen.getByText("Waiting on gate")).toBeInTheDocument();
  });

  it("does not render gate section when selected task has no gate", async () => {
    const task = workflowJobFactory.build({
      id: 1,
      state: JobState.Completed,
      task: "send_response",
      waitReason: "none",
    });

    await renderWorkflowDetail(
      { id: "wf-test-no-gate", name: "Workflow Test", tasks: [task] },
      task.id,
    );

    expect(screen.queryByRole("heading", { name: "Gate" })).toBeNull();
    expect(screen.getByText("Not waiting")).toBeInTheDocument();
  });

  it("updates the lower inspector when the selected task changes", async () => {
    const firstTask = workflowJobFactory.build({
      id: 1,
      state: JobState.Completed,
      task: "classify_intake",
      waitReason: "none",
    });
    const secondTask = workflowJobFactory.build({
      deps: ["classify_intake"],
      gate: {
        declaredSignals: ["approval.received"],
        enabled: true,
        exprCel: 'signals["approval.received"].size() > 0',
        phase: "waiting",
        timers: [],
      },
      id: 2,
      state: JobState.Pending,
      task: "send_response",
      waitReason: "gate",
    });

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });

    const jobsRoute = createRoute({
      component: () => <div>Job route</div>,
      getParentRoute: () => rootRoute,
      path: "/jobs/$jobId",
    });

    const SelectionHarness = () => {
      const [selectedJobId, setSelectedJobId] = React.useState<
        bigint | undefined
      >(undefined);

      return (
        <FeaturesContext.Provider value={{ features }}>
          <WorkflowDetail
            loading={false}
            selectedJobId={selectedJobId}
            setSelectedJobId={setSelectedJobId}
            workflow={{
              id: "wf-test-selection",
              name: "Workflow Test",
              tasks: [firstTask, secondTask],
            }}
          />
        </FeaturesContext.Provider>
      );
    };

    const workflowRoute = createRoute({
      component: SelectionHarness,
      getParentRoute: () => rootRoute,
      path: "/",
    });

    const routeTree = rootRoute.addChildren([workflowRoute, jobsRoute]);
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree,
    });

    await act(async () => {
      await router.load();
      render(<RouterProvider router={router} />);
    });

    expect(screen.queryByText("Gate")).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "Select send_response" }).click();
    });

    expect(screen.getByText("Gate")).toBeInTheDocument();
    expect(screen.getAllByText("Gate pending")).not.toHaveLength(0);
  });
});

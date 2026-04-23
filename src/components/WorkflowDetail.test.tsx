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
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("WorkflowDetail wait condition inspector", () => {
  it("shows structured wait-condition details in selected task inspector", async () => {
    const dependency = workflowJobFactory.build({
      id: 1,
      state: JobState.Completed,
      task: "classify_intake",
      waitReason: "none",
    });
    dependency.finalizedAt = new Date("2026-04-21T17:57:00Z");
    const waitingTask = workflowJobFactory.build({
      deps: ["classify_intake"],
      id: 2,
      state: JobState.Pending,
      task: "compose_draft_response",
      wait: {
        exprCel: "classify_intake_done && approval_received",
        phase: "waiting",
        signals: [
          {
            key: "approval.received",
            matched: false,
            matchedCount: 0,
            visibleCount: 0,
          },
        ],
        startedAt: new Date("2026-04-21T17:58:00Z"),
        summary: "Waiting for approval.received.",
        terms: [
          {
            kind: "dependency_output",
            label: "Classify intake done",
            matched: true,
            name: "classify_intake_done",
          },
          {
            kind: "signal",
            label: "Approval received",
            matched: false,
            name: "approval_received",
          },
        ],
        timers: [
          {
            fired: false,
            matched: false,
            name: "escalation",
          },
        ],
      },
      waitReason: "wait_condition",
    });

    await renderWorkflowDetail(
      {
        id: "wf-test-wait",
        name: "Workflow Test",
        tasks: [dependency, waitingTask],
      },
      waitingTask.id,
    );

    expect(
      screen.getByRole("heading", { name: "Wait condition" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Waiting")).not.toHaveLength(0);
    expect(screen.getByText("Not yet staged")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Details" }));
    });
    expect(screen.getByText("Dependency")).toBeInTheDocument();
    expect(screen.queryByText("Dependency output")).toBeNull();
    expect(screen.getByText("Finalized")).toBeInTheDocument();
    expect(screen.getAllByText("approval.received")).not.toHaveLength(0);
    expect(screen.getAllByText("escalation")).not.toHaveLength(0);
    expect(screen.getAllByText("Waiting on wait condition")).not.toHaveLength(
      0,
    );
    expect(screen.queryByText("Wait condition started")).toBeNull();
    expect(screen.queryByText("Wait")).toBeNull();
  });

  it("does not render wait-condition section when selected task has no wait condition", async () => {
    const task = workflowJobFactory.build({
      id: 1,
      state: JobState.Completed,
      task: "send_response",
      waitReason: "none",
    });

    await renderWorkflowDetail(
      { id: "wf-test-no-wait", name: "Workflow Test", tasks: [task] },
      task.id,
    );

    expect(
      screen.queryByRole("heading", { name: "Wait condition" }),
    ).toBeNull();
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
      id: 2,
      state: JobState.Pending,
      task: "send_response",
      wait: {
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
        terms: [
          {
            kind: "signal",
            label: "Approval received",
            matched: false,
            name: "approval_received",
          },
        ],
        timers: [],
      },
      waitReason: "wait_condition",
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

    expect(
      screen.queryByRole("heading", { name: "Wait condition" }),
    ).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "Select send_response" }).click();
    });

    expect(
      screen.getByRole("heading", { name: "Wait condition" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Waiting")).not.toHaveLength(0);
  });

  it("renders grouped timeline milestones instead of a flat event dump", async () => {
    const collectInputs = {
      ...workflowJobFactory.build({
        id: 11,
        state: JobState.Completed,
        task: "collect_inputs",
        waitReason: "none",
      }),
      finalizedAt: new Date("2026-04-21T17:58:00Z"),
    };
    const safetyReview = {
      ...workflowJobFactory.build({
        id: 12,
        state: JobState.Completed,
        task: "safety_review",
        waitReason: "none",
      }),
      finalizedAt: new Date("2026-04-21T17:59:00Z"),
    };
    const releaseTask = {
      ...workflowJobFactory.build({
        deps: ["collect_inputs", "safety_review"],
        id: 13,
        state: JobState.Completed,
        task: "launch_release",
        wait: {
          exprCel: "launch_override_received || release_timeout_reached",
          phase: "resolved" as const,
          resolvedAt: new Date("2026-04-21T18:01:00Z"),
          signals: [],
          startedAt: new Date("2026-04-21T18:00:00Z"),
          summary: "Launch override received",
          terms: [
            {
              kind: "signal",
              label: "Launch override received",
              matched: true,
              name: "launch_override_received",
            },
            {
              kind: "timer",
              label: "Release timeout reached",
              matched: true,
              name: "release_timeout_reached",
            },
          ],
          timers: [],
        },
        waitReason: "none",
      }),
      attemptedAt: new Date("2026-04-21T18:02:00Z"),
      finalizedAt: new Date("2026-04-21T18:02:12Z"),
      stagedAt: new Date("2026-04-21T18:01:30Z"),
    };

    await renderWorkflowDetail(
      {
        id: "wf-test-timeline",
        name: "Workflow Test",
        tasks: [collectInputs, safetyReview, releaseTask],
      },
      releaseTask.id,
    );

    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dependencies completed")).toBeInTheDocument();
    expect(screen.getAllByText("collect_inputs")).not.toHaveLength(0);
    expect(screen.getAllByText("safety_review")).not.toHaveLength(0);
    expect(screen.getByText("Wait condition resolved")).toBeInTheDocument();
    expect(screen.queryByText("Wait condition started")).toBeNull();
    expect(
      screen.getByText(
        "2 terms matched and the wait expression evaluated true.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("launch_override_received")).not.toHaveLength(0);
    expect(screen.getAllByText("release_timeout_reached")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "launch_override_received" }),
      );
    });

    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("2 of 2 conditions matched")).toBeInTheDocument();
    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.getByText("Task started")).toBeInTheDocument();
    expect(screen.getByText("Task completed")).toBeInTheDocument();
  });

  it("shows dependency tasks once in the timeline without collapsing them", async () => {
    const deps = [
      "offline_eval_billing",
      "offline_eval_onboarding",
      "offline_eval_support",
      "safety_scan_core",
      "safety_scan_prompting",
    ] as const;

    const dependencyTasks = deps.map((taskName, index) => ({
      ...workflowJobFactory.build({
        id: BigInt(100 + index),
        state: JobState.Completed,
        task: taskName,
        waitReason: "none",
      }),
      finalizedAt: new Date(`2026-04-21T17:${55 + index}:00Z`),
    }));

    const waitingTask = workflowJobFactory.build({
      deps: [...deps],
      id: 200n,
      state: JobState.Pending,
      task: "launch_release",
      wait: {
        exprCel: "launch_timeout_reached",
        phase: "waiting",
        signals: [],
        startedAt: new Date("2026-04-21T18:02:00Z"),
        summary: "Waiting for launch timeout.",
        terms: [
          {
            kind: "timer",
            label: "Launch timeout reached",
            matched: false,
            name: "launch_timeout_reached",
          },
        ],
        timers: [],
      },
      waitReason: "wait_condition",
    });

    await renderWorkflowDetail(
      {
        id: "wf-test-timeline-expand",
        name: "Workflow Test",
        tasks: [...dependencyTasks, waitingTask],
      },
      waitingTask.id,
    );

    expect(screen.getAllByText("safety_scan_prompting")).toHaveLength(1);
    expect(screen.queryByText("Show 2 more")).toBeNull();
    expect(
      screen.getByRole("link", { name: /offline_eval_billing/i }),
    ).toHaveAttribute("href", "/?selected=100");
  });

  it("previews a not-started wait condition from the dependency milestone", async () => {
    const completedDep = {
      ...workflowJobFactory.build({
        id: 401n,
        state: JobState.Completed,
        task: "fetch_account_context",
        waitReason: "none",
      }),
      finalizedAt: new Date("2026-04-21T17:58:00Z"),
    };

    const runningDep = {
      ...workflowJobFactory.build({
        id: 402n,
        state: JobState.Running,
        task: "fetch_entitlements",
        waitReason: "none",
      }),
      attemptedAt: new Date("2026-04-21T17:59:00Z"),
    };

    const pendingDep = workflowJobFactory.build({
      id: 403n,
      state: JobState.Pending,
      task: "fetch_recent_charges",
      waitReason: "none",
    });

    const blockedTask = workflowJobFactory.build({
      deps: [
        "fetch_account_context",
        "fetch_entitlements",
        "fetch_recent_charges",
      ],
      id: 404n,
      state: JobState.Pending,
      task: "promote_global",
      wait: {
        exprCel: "approval_received || launch_timeout_reached",
        phase: "not_started",
        signals: [],
        summary:
          "Waits for approval or timeout after dependency checks finish.",
        terms: [
          {
            kind: "signal",
            label: "Approval received",
            matched: false,
            name: "approval_received",
          },
          {
            kind: "timer",
            label: "Launch timeout reached",
            matched: false,
            name: "launch_timeout_reached",
          },
        ],
        timers: [],
      },
      waitReason: "dependencies_and_wait_condition",
    });

    await renderWorkflowDetail(
      {
        id: "wf-test-not-started-wait",
        name: "Workflow Test",
        tasks: [completedDep, runningDep, pendingDep, blockedTask],
      },
      blockedTask.id,
    );

    expect(screen.getByText("Dependencies progressing")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Then waits for approval or timeout after dependency checks finish.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Waiting on wait condition")).toBeNull();
    expect(screen.queryByText("Wait")).toBeNull();
  });

  it("shows long matched-term lists without collapsing", async () => {
    const resolvedTask = {
      ...workflowJobFactory.build({
        id: 301n,
        state: JobState.Completed,
        task: "launch_release",
        wait: {
          exprCel:
            "term_one || term_two || term_three || term_four || term_five",
          phase: "resolved" as const,
          resolvedAt: new Date("2026-04-21T18:05:00Z"),
          signals: [],
          startedAt: new Date("2026-04-21T18:04:00Z"),
          terms: [
            {
              kind: "signal",
              label: "Term one",
              matched: true,
              name: "term_one",
            },
            {
              kind: "signal",
              label: "Term two",
              matched: true,
              name: "term_two",
            },
            {
              kind: "signal",
              label: "Term three",
              matched: true,
              name: "term_three",
            },
            {
              kind: "signal",
              label: "Term four",
              matched: true,
              name: "term_four",
            },
            {
              kind: "signal",
              label: "Term five",
              matched: true,
              name: "term_five",
            },
          ],
          timers: [],
        },
        waitReason: "none",
      }),
      finalizedAt: new Date("2026-04-21T18:05:10Z"),
    };

    await renderWorkflowDetail(
      {
        id: "wf-test-term-expand",
        name: "Workflow Test",
        tasks: [resolvedTask],
      },
      resolvedTask.id,
    );

    expect(screen.queryByText("Show 2 more")).toBeNull();
    expect(screen.getAllByText("term_four")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Show fewer" })).toBeNull();
  });
});

import type {
  Workflow,
  WorkflowTask,
  WorkflowTaskSignal,
  WorkflowTaskWait,
  WorkflowTaskWaitDiagnostics,
} from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { createFeatures } from "@test/utils/features";
import { add, sub } from "date-fns";
import { useState } from "react";

import type {
  TaskSignalLoader,
  TaskWaitDiagnosticsLoader,
} from "./WorkflowGateInspector";

import WorkflowDetail from "./WorkflowDetail";

const storyFeatures = createFeatures({
  workflowQueries: true,
});

const storyNow = new Date();

const storyTimeAgo = (seconds: number): Date => sub(storyNow, { seconds });

const pendingTaskTiming = (
  createdSecondsAgo: number,
): Partial<WorkflowTask> => {
  const createdAt = storyTimeAgo(createdSecondsAgo);

  return {
    createdAt,
    scheduledAt: createdAt,
    stagedAt: createdAt,
  };
};

const buildTask = (
  task: string,
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask => {
  return {
    ...workflowJobFactory.build({
      deps: overrides.deps ?? [],
      ...(overrides.attemptedAt !== undefined
        ? { attemptedAt: overrides.attemptedAt }
        : {}),
      ...(overrides.createdAt !== undefined
        ? { createdAt: overrides.createdAt }
        : {}),
      ...(overrides.finalizedAt !== undefined
        ? { finalizedAt: overrides.finalizedAt }
        : {}),
      id: overrides.id,
      ...(overrides.scheduledAt !== undefined
        ? { scheduledAt: overrides.scheduledAt }
        : {}),
      ...(overrides.stagedAt !== undefined
        ? { stagedAt: overrides.stagedAt }
        : {}),
      state: overrides.state,
      task,
      wait: overrides.wait,
      waitReason: overrides.waitReason,
      workflowID: overrides.workflowID,
      workflowStagedAt: overrides.stagedAt,
    }),
    ...overrides,
  };
};

const buildWait = (overrides: Partial<WorkflowTaskWait>): WorkflowTaskWait => {
  return {
    exprCel: "",
    inputs: { deps: [], signals: [], timers: [] },
    phase: "waiting",
    terms: [],
    ...overrides,
  };
};

const buildWaitDiagnostics = (
  wait: WorkflowTaskWait,
  overrides: Partial<WorkflowTaskWaitDiagnostics> = {},
): WorkflowTaskWaitDiagnostics => {
  return {
    inputs: {
      deps: wait.inputs.deps.map((dep) => ({
        available: dep.result?.available ?? false,
        finalizedAt: dep.result?.finalizedAt,
        state: dep.result?.state,
        taskName: dep.taskName,
      })),
      signals: wait.inputs.signals.map((signal) => ({
        includedCount: signal.result?.includedCount ?? 0,
        key: signal.key,
        lastID: signal.result?.lastIncludedID,
      })),
      timers: wait.inputs.timers.map((timer) => ({
        fireAt: timer.result?.fireAt ?? timer.fireAt,
        fired: timer.result?.fired ?? false,
        name: timer.name,
      })),
    },
    inspectedAt: storyTimeAgo(5),
    phase: wait.phase,
    signalScanCount: wait.inputs.signals.length,
    signalScanLimit: 10000,
    terms: wait.terms.map((term) => ({
      lastMatchedID: term.result?.lastMatchedID,
      matchedCount: term.result?.matchedCount ?? 0,
      name: term.name,
      requiredCount: term.result?.requiredCount ?? 0,
      satisfied: term.result?.satisfied ?? false,
    })),
    truncated: false,
    workflowAttempt: 1,
    ...overrides,
  };
};

const buildWorkflow = (id: string, name: string, tasks: WorkflowTask[]) => ({
  id,
  name,
  tasks,
});

type StorySignalFixtures = Record<
  string,
  Partial<Record<"evidence" | "history", WorkflowTaskSignal[]>>
>;

const buildSignal = ({
  attempt = 1,
  createdAt,
  id,
  key,
  payload,
  source,
}: {
  attempt?: number;
  createdAt: Date;
  id: bigint;
  key: string;
  payload: unknown;
  source: unknown;
}): WorkflowTaskSignal => ({
  attempt,
  createdAt,
  id,
  key,
  payload,
  source,
});

const compareSignalsDesc = (
  leftSignal: WorkflowTaskSignal,
  rightSignal: WorkflowTaskSignal,
): number => {
  if (leftSignal.id > rightSignal.id) return -1;
  if (leftSignal.id < rightSignal.id) return 1;
  return 0;
};

const createStorySignalLoader = (
  fixtures: StorySignalFixtures,
): TaskSignalLoader => {
  return async ({ cursorID, key, limit = 20, scope }) => {
    const scopeKey = scope ?? "history";
    const signals = key
      ? (fixtures[key]?.[scopeKey] ?? [])
      : Object.values(fixtures).flatMap((fixture) => fixture[scopeKey] ?? []);
    const sortedSignals = [...signals].sort(compareSignalsDesc);
    const cursorBigInt = cursorID === undefined ? undefined : BigInt(cursorID);
    const cursorIndex =
      cursorBigInt === undefined
        ? -1
        : sortedSignals.findIndex((signal) => signal.id === cursorBigInt);
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const page = sortedSignals.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + page.length < sortedSignals.length;
    const lastSignal = page[page.length - 1];

    return {
      hasMore,
      nextCursorID: hasMore ? lastSignal?.id : undefined,
      scope: scopeKey,
      signals: page,
    };
  };
};

const storySignalLoader = createStorySignalLoader({
  "approval.received": {
    evidence: [
      buildSignal({
        createdAt: storyTimeAgo(120),
        id: 9123n,
        key: "approval.received",
        payload: {
          approved: true,
          reviewer: "manager",
          ticket_id: "approval-9123",
        },
        source: {
          source: "review-console",
        },
      }),
    ],
    history: [
      buildSignal({
        createdAt: storyTimeAgo(120),
        id: 9123n,
        key: "approval.received",
        payload: {
          approved: true,
          reviewer: "manager",
          ticket_id: "approval-9123",
        },
        source: {
          source: "review-console",
        },
      }),
    ],
  },
});

const storyWaitDiagnostics = new Map<string, WorkflowTaskWaitDiagnostics>();

const storyWaitDiagnosticsKey = (workflowID: string, taskName: string) =>
  `${workflowID}:${taskName}`;

const registerStoryWaitDiagnostics = (
  task: WorkflowTask,
  overrides: Partial<WorkflowTaskWaitDiagnostics> = {},
) => {
  if (task.wait === undefined) return;

  storyWaitDiagnostics.set(
    storyWaitDiagnosticsKey(task.workflowID, task.name),
    buildWaitDiagnostics(task.wait, overrides),
  );
};

const storyWaitDiagnosticsLoader: TaskWaitDiagnosticsLoader = async ({
  taskName,
  workflowID,
}) => {
  const diagnostics = storyWaitDiagnostics.get(
    storyWaitDiagnosticsKey(workflowID, taskName),
  );

  if (diagnostics === undefined) {
    throw new Error("No Storybook waiting diagnostics fixture.");
  }

  return diagnostics;
};

const buildWaitingWorkflow = (): Workflow => {
  const classify = {
    ...buildTask("classify_intake", {
      finalizedAt: storyTimeAgo(360),
      id: 1001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
  };

  const reviewStartedAt = storyTimeAgo(150);
  const review = buildTask("await_review", {
    ...pendingTaskTiming(210),
    deps: ["classify_intake"],
    id: 1002n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "approval_received || review_timeout_reached",
      inputs: {
        deps: [],
        signals: [
          {
            key: "approval.received",
          },
        ],
        timers: [
          {
            afterSeconds: 300,
            anchor: { kind: "wait_started_at" },
            name: "review_timeout",
          },
        ],
      },
      phase: "waiting",
      startedAt: reviewStartedAt,
      summary: "Waiting for human approval or review timeout.",
      terms: [
        {
          kind: "signal",
          label: "Human approval received",
          name: "approval_received",
          result: { matchedCount: 0, requiredCount: 1, satisfied: false },
          signalKey: "approval.received",
        },
        {
          kind: "timer",
          label: "Review SLA timeout reached",
          name: "review_timeout_reached",
          result: { matchedCount: 0, requiredCount: 0, satisfied: false },
        },
      ],
    }),
    waitReason: "wait",
  });
  registerStoryWaitDiagnostics(review, { exprResult: false });

  const send = buildTask("send_response", {
    ...pendingTaskTiming(180),
    deps: ["await_review"],
    id: 1003n,
    state: JobState.Pending,
    waitReason: "dependencies",
  });

  return buildWorkflow("wf-story-wait-blocked", "Customer Intake Workflow", [
    classify,
    review,
    send,
  ]);
};

const buildDependenciesProgressingWorkflow = (): Workflow => {
  const fetchAccount = {
    ...buildTask("fetch_account_context", {
      finalizedAt: storyTimeAgo(180),
      id: 3001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
  };

  const fetchEntitlements = buildTask("fetch_entitlements", {
    attemptedAt: storyTimeAgo(90),
    id: 3002n,
    state: JobState.Running,
    waitReason: "none",
  });

  const fetchCharges = buildTask("fetch_recent_charges", {
    ...pendingTaskTiming(150),
    id: 3003n,
    state: JobState.Pending,
    waitReason: "none",
  });

  const promote = buildTask("promote_global", {
    ...pendingTaskTiming(120),
    deps: [
      "fetch_account_context",
      "fetch_entitlements",
      "fetch_recent_charges",
    ],
    id: 3004n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "approval_received || launch_timeout_reached",
      inputs: {
        deps: [],
        signals: [
          {
            key: "approval.received",
          },
        ],
        timers: [
          {
            afterSeconds: 600,
            anchor: { kind: "task_finalized_at", task: "fetch_recent_charges" },
            name: "launch_timeout",
          },
        ],
      },
      phase: "not_started",
      summary: "Waits for approval or timeout after dependency checks finish.",
      terms: [
        {
          kind: "signal",
          label: "Approval received",
          name: "approval_received",
          result: { matchedCount: 0, requiredCount: 1, satisfied: false },
          signalKey: "approval.received",
        },
        {
          kind: "timer",
          label: "Launch timeout reached",
          name: "launch_timeout_reached",
          result: { matchedCount: 0, requiredCount: 0, satisfied: false },
        },
      ],
    }),
    waitReason: "dependencies_and_wait",
  });
  registerStoryWaitDiagnostics(promote);

  return buildWorkflow(
    "wf-story-dependencies-progressing",
    "Dependencies Still Progressing",
    [fetchAccount, fetchEntitlements, fetchCharges, promote],
  );
};

const buildResolvedBySignalWorkflow = (): Workflow => {
  const collect = {
    ...buildTask("collect_inputs", {
      finalizedAt: storyTimeAgo(190),
      id: 2001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
  };
  const safetyReview = {
    ...buildTask("safety_review", {
      finalizedAt: storyTimeAgo(160),
      id: 2002n,
      state: JobState.Completed,
      waitReason: "none",
    }),
  };
  const waitStartedAt = storyTimeAgo(120);
  const waitResolvedAt = storyTimeAgo(90);
  const taskStagedAt = storyTimeAgo(80);
  const taskAttemptedAt = storyTimeAgo(70);
  const taskFinalizedAt = storyTimeAgo(58);
  const approve = {
    ...buildTask("await_review", {
      attemptedAt: taskAttemptedAt,
      deps: ["collect_inputs", "safety_review"],
      finalizedAt: taskFinalizedAt,
      id: 2003n,
      stagedAt: taskStagedAt,
      state: JobState.Completed,
      wait: buildWait({
        evidence: {
          evaluatedAt: waitResolvedAt,
          workflowAttempt: 1,
        },
        exprCel: "approval_received || review_timeout_reached",
        inputs: {
          deps: [],
          signals: [
            {
              key: "approval.received",
              result: {
                includedCount: 1,
                lastIncludedID: 9123n,
              },
            },
          ],
          timers: [
            {
              afterSeconds: 300,
              anchor: { kind: "wait_started_at" },
              fireAt: add(waitStartedAt, { seconds: 300 }),
              name: "review_timeout",
            },
          ],
        },
        phase: "resolved",
        resolvedAt: waitResolvedAt,
        startedAt: waitStartedAt,
        summary: "Human approval received",
        terms: [
          {
            kind: "signal",
            label: "Human approval received",
            name: "approval_received",
            result: {
              lastMatchedID: 9123n,
              matchedCount: 1,
              requiredCount: 1,
              satisfied: true,
            },
            signalKey: "approval.received",
          },
          {
            kind: "timer",
            label: "Review SLA timeout reached",
            name: "review_timeout_reached",
            result: { matchedCount: 0, requiredCount: 0, satisfied: false },
          },
        ],
      }),
      waitReason: "none",
    }),
  };

  return buildWorkflow("wf-story-wait-resolved-signal", "Approval Workflow", [
    collect,
    safetyReview,
    approve,
  ]);
};

const buildResolvedByTimeoutWorkflow = (): Workflow => {
  const canaryChecks = [
    "canary_check_cost",
    "canary_check_errors",
    "canary_check_latency",
    "canary_check_safety",
    "canary_check_support_quality",
    "deploy_canary",
  ].map((taskName, index) => ({
    ...buildTask(taskName, {
      finalizedAt: storyTimeAgo(300 - index * 20),
      id: BigInt(4001 + index),
      state: JobState.Completed,
      waitReason: "none",
    }),
  }));

  const waitStartedAt = storyTimeAgo(180);
  const waitResolvedAt = storyTimeAgo(109);
  const taskStagedAt = storyTimeAgo(109);
  const promote = {
    ...buildTask("promote_global", {
      deps: canaryChecks.map((task) => task.name),
      finalizedAt: storyTimeAgo(103),
      id: 4010n,
      stagedAt: taskStagedAt,
      state: JobState.Completed,
      wait: buildWait({
        evidence: {
          evaluatedAt: waitResolvedAt,
          workflowAttempt: 1,
        },
        exprCel: "release_canary_metrics_received || canary_timeout_reached",
        inputs: {
          deps: [],
          signals: [
            {
              key: "release_canary_metrics",
            },
          ],
          timers: [
            {
              afterSeconds: 71,
              anchor: { kind: "task_finalized_at", task: "deploy_canary" },
              fireAt: waitResolvedAt,
              name: "canary_timeout",
            },
          ],
        },
        phase: "resolved",
        resolvedAt: waitResolvedAt,
        startedAt: waitStartedAt,
        summary: "Canary timeout reached",
        terms: [
          {
            kind: "signal",
            label: "Release canary metrics received",
            name: "release_canary_metrics_received",
            result: { matchedCount: 0, requiredCount: 1, satisfied: false },
            signalKey: "release_canary_metrics",
          },
          {
            kind: "timer",
            label: "Canary timeout reached",
            name: "canary_timeout_reached",
            result: { matchedCount: 0, requiredCount: 0, satisfied: true },
          },
        ],
      }),
      waitReason: "none",
    }),
  };

  return buildWorkflow(
    "wf-story-wait-resolved-timeout",
    "Timeout-Resolved Workflow",
    [...canaryChecks, promote],
  );
};

const buildDirectWaitWorkflow = (): Workflow => {
  const startedAt = sub(storyNow, { minutes: 12 });
  const task = buildTask("await_external_signal", {
    id: 5001n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "customer_acknowledged || escalation_timeout_reached",
      inputs: {
        deps: [],
        signals: [
          {
            key: "customer.acknowledged",
          },
        ],
        timers: [
          {
            afterSeconds: 900,
            anchor: { kind: "wait_started_at" },
            name: "escalation_timeout",
          },
        ],
      },
      phase: "waiting",
      startedAt,
      summary: "Waiting for customer acknowledgement or escalation timeout.",
      terms: [
        {
          kind: "signal",
          label: "Customer acknowledged",
          name: "customer_acknowledged",
          result: { matchedCount: 0, requiredCount: 1, satisfied: false },
          signalKey: "customer.acknowledged",
        },
        {
          kind: "timer",
          label: "Escalation timeout reached",
          name: "escalation_timeout_reached",
          result: { matchedCount: 0, requiredCount: 0, satisfied: false },
        },
      ],
    }),
    waitReason: "wait",
  });
  registerStoryWaitDiagnostics(task, { exprResult: false });

  return buildWorkflow("wf-story-direct-wait", "Direct Wait Workflow", [task]);
};

const meta: Meta<typeof WorkflowDetail> = {
  component: WorkflowDetail,
  parameters: {
    layout: "fullscreen",
  },
  title: "Components/WorkflowDetail",
};

export default meta;

type Story = StoryObj<typeof WorkflowDetail>;

const StatefulStory = ({
  initialSelectedJobId,
  workflow,
}: {
  initialSelectedJobId?: bigint;
  workflow: undefined | Workflow;
}) => {
  const [selectedJobId, setSelectedJobId] = useState<bigint | undefined>(
    initialSelectedJobId ?? workflow?.tasks[0]?.id,
  );

  return (
    <WorkflowDetail
      loading={false}
      loadTaskSignals={storySignalLoader}
      loadTaskWaitDiagnostics={storyWaitDiagnosticsLoader}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      workflow={workflow}
    />
  );
};

const renderSelectedTask = (workflow: Workflow, taskName: string) => (
  <StatefulStory
    initialSelectedJobId={
      workflow.tasks.find((task) => task.name === taskName)?.id
    }
    workflow={workflow}
  />
);

export const DependenciesProgressing: Story = {
  args: {
    workflow: buildDependenciesProgressingWorkflow(),
  },
  parameters: {
    features: storyFeatures,
  },
  render: (args) => renderSelectedTask(args.workflow!, "promote_global"),
};

export const Waiting: Story = {
  args: {
    workflow: buildWaitingWorkflow(),
  },
  parameters: {
    features: storyFeatures,
  },
  render: (args) => renderSelectedTask(args.workflow!, "await_review"),
};

export const WaitingWithoutDependencies: Story = {
  args: {
    workflow: buildDirectWaitWorkflow(),
  },
  parameters: {
    features: storyFeatures,
  },
  render: (args) => renderSelectedTask(args.workflow!, "await_external_signal"),
};

export const ResolvedBySignal: Story = {
  args: {
    workflow: buildResolvedBySignalWorkflow(),
  },
  parameters: {
    features: storyFeatures,
  },
  render: (args) => renderSelectedTask(args.workflow!, "await_review"),
};

export const ResolvedByTimeout: Story = {
  args: {
    workflow: buildResolvedByTimeoutWorkflow(),
  },
  parameters: {
    features: storyFeatures,
  },
  render: (args) => renderSelectedTask(args.workflow!, "promote_global"),
};

export const FeatureDisabled: Story = {
  args: {
    workflow: buildWaitingWorkflow(),
  },
  parameters: {
    features: createFeatures({
      workflowQueries: false,
    }),
  },
  render: (args) => <StatefulStory workflow={args.workflow} />,
};

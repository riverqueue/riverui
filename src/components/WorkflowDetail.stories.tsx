import type {
  Workflow,
  WorkflowTask,
  WorkflowTaskWait,
} from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { createFeatures } from "@test/utils/features";
import { useState } from "react";

import WorkflowDetail from "./WorkflowDetail";

const storyFeatures = createFeatures({
  hasWorkflows: true,
  workflowQueries: true,
});

const buildTask = (
  task: string,
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask => {
  return {
    ...workflowJobFactory.build({
      deps: overrides.deps,
      id: overrides.id,
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
    phase: "waiting",
    signals: [],
    terms: [],
    timers: [],
    ...overrides,
  };
};

const buildWorkflow = (id: string, name: string, tasks: WorkflowTask[]) => ({
  id,
  name,
  tasks,
});

const buildWaitingWorkflow = (): Workflow => {
  const classify = {
    ...buildTask("classify_intake", {
      id: 1001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
    finalizedAt: new Date("2026-01-01T00:34:00.000Z"),
  };

  const review = buildTask("await_review", {
    deps: ["classify_intake"],
    id: 1002n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "approval_received || review_timeout_reached",
      phase: "waiting",
      signals: [
        {
          key: "approval.received",
          matched: false,
          matchedCount: 0,
          visibleCount: 0,
        },
      ],
      startedAt: new Date("2026-01-01T00:35:00.000Z"),
      summary: "Waiting for human approval or review timeout.",
      terms: [
        {
          kind: "signal",
          label: "Human approval received",
          matched: false,
          name: "approval_received",
        },
        {
          kind: "timer",
          label: "Review SLA timeout reached",
          matched: false,
          name: "review_timeout_reached",
        },
      ],
      timers: [
        {
          afterSeconds: 300,
          anchor: { kind: "wait_started_at" },
          fired: false,
          matched: false,
          name: "review_timeout",
        },
      ],
    }),
    waitReason: "wait",
  });

  const send = buildTask("send_response", {
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
      id: 3001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
    finalizedAt: new Date("2026-01-01T00:30:00.000Z"),
  };

  const fetchEntitlements = buildTask("fetch_entitlements", {
    attemptedAt: new Date("2026-01-01T00:31:00.000Z"),
    id: 3002n,
    state: JobState.Running,
    waitReason: "none",
  });

  const fetchCharges = buildTask("fetch_recent_charges", {
    id: 3003n,
    state: JobState.Pending,
    waitReason: "none",
  });

  const promote = buildTask("promote_global", {
    deps: [
      "fetch_account_context",
      "fetch_entitlements",
      "fetch_recent_charges",
    ],
    id: 3004n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "approval_received || launch_timeout_reached",
      phase: "not_started",
      summary: "Waits for approval or timeout after dependency checks finish.",
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
      timers: [
        {
          afterSeconds: 600,
          anchor: { kind: "task_finalized_at", task: "fetch_recent_charges" },
          fired: false,
          matched: false,
          name: "launch_timeout",
        },
      ],
    }),
    waitReason: "dependencies_and_wait",
  });

  return buildWorkflow(
    "wf-story-dependencies-progressing",
    "Dependencies Still Progressing",
    [fetchAccount, fetchEntitlements, fetchCharges, promote],
  );
};

const buildResolvedBySignalWorkflow = (): Workflow => {
  const collect = {
    ...buildTask("collect_inputs", {
      id: 2001n,
      state: JobState.Completed,
      waitReason: "none",
    }),
    finalizedAt: new Date("2026-01-01T00:38:00.000Z"),
  };
  const safetyReview = {
    ...buildTask("safety_review", {
      id: 2002n,
      state: JobState.Completed,
      waitReason: "none",
    }),
    finalizedAt: new Date("2026-01-01T00:39:00.000Z"),
  };
  const approve = {
    ...buildTask("await_review", {
      deps: ["collect_inputs", "safety_review"],
      id: 2003n,
      state: JobState.Completed,
      wait: buildWait({
        asOf: new Date("2026-01-01T00:45:00.000Z"),
        attempt: 1,
        exprCel: "approval_received || review_timeout_reached",
        phase: "resolved",
        resolvedAt: new Date("2026-01-01T00:45:00.000Z"),
        signals: [
          {
            key: "approval.received",
            lastMatchedID: 901n,
            lastVisibleID: 901n,
            matched: true,
            matchedCount: 1,
            visibleCount: 1,
          },
        ],
        startedAt: new Date("2026-01-01T00:40:00.000Z"),
        summary: "Human approval received",
        terms: [
          {
            kind: "signal",
            label: "Human approval received",
            matched: true,
            name: "approval_received",
          },
          {
            kind: "timer",
            label: "Review SLA timeout reached",
            matched: false,
            name: "review_timeout_reached",
          },
        ],
        timers: [
          {
            afterSeconds: 300,
            anchor: { kind: "wait_started_at" },
            fireAt: new Date("2026-01-01T00:45:00.000Z"),
            fired: false,
            matched: false,
            name: "review_timeout",
          },
        ],
      }),
      waitReason: "none",
    }),
    attemptedAt: new Date("2026-01-01T00:45:30.000Z"),
    finalizedAt: new Date("2026-01-01T00:45:42.000Z"),
    stagedAt: new Date("2026-01-01T00:45:10.000Z"),
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
      id: BigInt(4001 + index),
      state: JobState.Completed,
      waitReason: "none",
    }),
    finalizedAt: new Date(`2026-01-01T00:${36 + index}:00.000Z`),
  }));

  const promote = {
    ...buildTask("promote_global", {
      deps: canaryChecks.map((task) => task.name),
      id: 4010n,
      state: JobState.Completed,
      wait: buildWait({
        asOf: new Date("2026-01-01T00:47:00.000Z"),
        attempt: 1,
        exprCel: "release_canary_metrics_received || canary_timeout_reached",
        phase: "resolved",
        resolvedAt: new Date("2026-01-01T00:47:00.000Z"),
        signals: [
          {
            key: "release_canary_metrics",
            matched: false,
            matchedCount: 0,
            visibleCount: 0,
          },
        ],
        startedAt: new Date("2026-01-01T00:45:49.000Z"),
        summary: "Canary timeout reached",
        terms: [
          {
            kind: "signal",
            label: "Release canary metrics received",
            matched: false,
            name: "release_canary_metrics_received",
          },
          {
            kind: "timer",
            label: "Canary timeout reached",
            matched: true,
            name: "canary_timeout_reached",
          },
        ],
        timers: [
          {
            afterSeconds: 71,
            anchor: { kind: "task_finalized_at", task: "deploy_canary" },
            fireAt: new Date("2026-01-01T00:47:00.000Z"),
            fired: true,
            matched: true,
            name: "canary_timeout",
          },
        ],
      }),
      waitReason: "none",
    }),
    attemptedAt: new Date("2026-01-01T00:47:00.760Z"),
    finalizedAt: new Date("2026-01-01T00:47:06.210Z"),
    stagedAt: new Date("2026-01-01T00:47:00.000Z"),
  };

  return buildWorkflow(
    "wf-story-wait-resolved-timeout",
    "Timeout-Resolved Workflow",
    [...canaryChecks, promote],
  );
};

const buildDirectWaitWorkflow = (): Workflow => {
  const task = buildTask("await_external_signal", {
    id: 5001n,
    state: JobState.Pending,
    wait: buildWait({
      exprCel: "customer_acknowledged || escalation_timeout_reached",
      phase: "waiting",
      startedAt: new Date("2026-01-01T00:20:00.000Z"),
      summary: "Waiting for customer acknowledgement or escalation timeout.",
      terms: [
        {
          kind: "signal",
          label: "Customer acknowledged",
          matched: false,
          name: "customer_acknowledged",
        },
        {
          kind: "timer",
          label: "Escalation timeout reached",
          matched: false,
          name: "escalation_timeout_reached",
        },
      ],
      timers: [
        {
          afterSeconds: 900,
          anchor: { kind: "wait_started_at" },
          fired: false,
          matched: false,
          name: "escalation_timeout",
        },
      ],
    }),
    waitReason: "wait",
  });

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
      hasWorkflows: false,
      workflowQueries: false,
    }),
  },
  render: (args) => <StatefulStory workflow={args.workflow} />,
};

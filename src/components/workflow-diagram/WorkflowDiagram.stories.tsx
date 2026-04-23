import type { WorkflowTask } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { add, sub } from "date-fns";
import { useEffect, useState } from "react";

import WorkflowDiagram from "./WorkflowDiagram";

const recentWorkflowStart = (secondsAgo: number) =>
  sub(new Date(), { seconds: secondsAgo });

const withTimestamps = (
  task: WorkflowTask,
  overrides: {
    attemptedAt?: Date;
    finalizedAt?: Date;
    scheduledAt?: Date;
  },
): WorkflowTask => ({ ...task, ...overrides });

const buildBaselineTasks = (): WorkflowTask[] => {
  const startedAt = recentWorkflowStart(12);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 1,
        state: JobState.Completed,
        task: "classify_intake",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 1 }),
        finalizedAt: add(startedAt, { seconds: 3 }),
        scheduledAt: startedAt,
      },
    ),
    workflowJobFactory.build({
      deps: ["classify_intake"],
      id: 2,
      state: JobState.Pending,
      task: "compose_draft_response",
      waitReason: "dependencies",
      workflowStagedAt: startedAt,
    }),
    workflowJobFactory.build({
      deps: ["compose_draft_response"],
      id: 3,
      state: JobState.Pending,
      task: "send_response",
      waitReason: "dependencies",
      workflowStagedAt: startedAt,
    }),
  ];
};

const buildResolvedAndWaitingTasks = (): WorkflowTask[] => {
  const startedAt = recentWorkflowStart(20);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 31,
        state: JobState.Completed,
        task: "collect_inputs",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 1 }),
        finalizedAt: add(startedAt, { seconds: 2 }),
        scheduledAt: startedAt,
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["collect_inputs"],
        id: 32,
        state: JobState.Completed,
        task: "review_ready",
        wait: {
          asOf: add(startedAt, { seconds: 8 }),
          attempt: 1,
          exprCel: "approval_received",
          phase: "resolved",
          resolvedAt: add(startedAt, { seconds: 8 }),
          signals: [
            {
              key: "approval.received",
              lastMatchedID: 4501n,
              lastVisibleID: 4501n,
              matched: true,
              matchedCount: 1,
              visibleCount: 1,
            },
          ],
          startedAt: add(startedAt, { seconds: 2 }),
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
        },
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 9 }),
        finalizedAt: add(startedAt, { seconds: 11 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    workflowJobFactory.build({
      deps: ["review_ready"],
      id: 33,
      state: JobState.Pending,
      task: "publish_response",
      wait: {
        exprCel: "final_sign_off_received",
        phase: "waiting",
        signals: [
          {
            key: "final_sign_off.received",
            matched: false,
            matchedCount: 0,
            visibleCount: 0,
          },
        ],
        startedAt: add(startedAt, { seconds: 11 }),
        summary: "Waiting for final sign-off.",
        terms: [
          {
            kind: "signal",
            label: "Final sign-off received",
            matched: false,
            name: "final_sign_off_received",
          },
        ],
        timers: [],
      },
      waitReason: "wait_condition",
      workflowStagedAt: startedAt,
    }),
  ];
};

const buildAgentCustomerResolutionTasks = (): WorkflowTask[] => {
  const startedAt = recentWorkflowStart(30);

  return [
    withTimestamps(
      workflowJobFactory.build({
        deps: [],
        id: 106,
        state: JobState.Completed,
        task: "plan_execution",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 1 }),
        finalizedAt: add(startedAt, { seconds: 2 }),
        scheduledAt: startedAt,
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 107,
        state: JobState.Completed,
        task: "call_billing_tool",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        finalizedAt: add(startedAt, { seconds: 4 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 108,
        state: JobState.Completed,
        task: "call_crm_tool",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        finalizedAt: add(startedAt, { seconds: 4 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 109,
        state: JobState.Completed,
        task: "call_entitlements_tool",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        finalizedAt: add(startedAt, { seconds: 6 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 110,
        state: JobState.Running,
        task: "call_risk_tool",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    workflowJobFactory.build({
      deps: ["call_billing_tool", "call_crm_tool", "call_entitlements_tool"],
      id: 111,
      state: JobState.Available,
      task: "compose_draft_response",
      wait: {
        asOf: add(startedAt, { seconds: 6 }),
        attempt: 1,
        exprCel: "draft_ready",
        phase: "resolved",
        resolvedAt: add(startedAt, { seconds: 6 }),
        signals: [],
        startedAt: add(startedAt, { seconds: 4 }),
        summary: "Draft requirements already satisfied",
        terms: [
          {
            kind: "dependency_output",
            label: "Draft requirements already satisfied",
            matched: true,
            name: "draft_ready",
          },
        ],
        timers: [],
      },
      waitReason: "none",
      workflowStagedAt: startedAt,
    }),
    workflowJobFactory.build({
      deps: ["call_risk_tool", "compose_draft_response", "plan_execution"],
      id: 113,
      state: JobState.Pending,
      task: "send_response",
      wait: {
        exprCel: "human_approval_received || review_sla_timeout",
        phase: "waiting",
        signals: [
          {
            key: "request_human_approval",
            matched: false,
            matchedCount: 0,
            visibleCount: 0,
          },
        ],
        startedAt: add(startedAt, { seconds: 6 }),
        summary: "Waiting for human approval or review SLA timeout.",
        terms: [
          {
            kind: "signal",
            label: "Human approval received",
            matched: false,
            name: "human_approval_received",
          },
          {
            kind: "timer",
            label: "Review SLA timeout reached",
            matched: false,
            name: "review_sla_timeout",
          },
        ],
        timers: [
          {
            afterSeconds: 55,
            anchor: { kind: "wait_started_at" },
            fireAt: add(startedAt, { seconds: 61 }),
            fired: false,
            matched: false,
            name: "review_sla_timeout",
          },
        ],
      },
      waitReason: "dependencies_and_wait_condition",
      workflowStagedAt: startedAt,
    }),
    workflowJobFactory.build({
      deps: ["send_response"],
      id: 114,
      state: JobState.Pending,
      task: "queue_follow_up_survey",
      wait: {
        exprCel: "follow_up_survey_delay",
        phase: "waiting",
        signals: [],
        terms: [
          {
            kind: "timer",
            label: "Follow-up survey delay reached",
            matched: false,
            name: "follow_up_survey_delay",
          },
        ],
        timers: [
          {
            afterSeconds: 1800,
            anchor: { kind: "wait_started_at" },
            fired: false,
            matched: false,
            name: "follow_up_survey_delay",
          },
        ],
      },
      waitReason: "dependencies_and_wait_condition",
      workflowStagedAt: startedAt,
    }),
    workflowJobFactory.build({
      deps: ["send_response"],
      id: 115,
      state: JobState.Pending,
      task: "sync_crm_case_notes",
      waitReason: "dependencies",
      workflowStagedAt: startedAt,
    }),
    workflowJobFactory.build({
      deps: ["send_response"],
      id: 116,
      state: JobState.Pending,
      task: "write_resolution_analytics",
      waitReason: "dependencies",
      workflowStagedAt: startedAt,
    }),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 118,
        state: JobState.Retryable,
        task: "retry_charge_lookup",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        scheduledAt: add(new Date(), { minutes: 15 }),
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 119,
        state: JobState.Scheduled,
        task: "schedule_manual_review_ping",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      { scheduledAt: add(new Date(), { minutes: 5 }) },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 120,
        state: JobState.Discarded,
        task: "discard_stale_context_refresh",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 3 }),
        finalizedAt: add(startedAt, { seconds: 4 }),
        scheduledAt: add(startedAt, { seconds: 2 }),
      },
    ),
    workflowJobFactory.build({
      deps: [
        "send_response",
        "sync_crm_case_notes",
        "write_resolution_analytics",
      ],
      id: 117,
      state: JobState.Pending,
      task: "close_case",
      wait: {
        exprCel: "customer_ack_received || close_case_timeout",
        phase: "waiting",
        signals: [
          {
            key: "request_customer_ack",
            matched: false,
            matchedCount: 0,
            visibleCount: 0,
          },
        ],
        terms: [
          {
            kind: "signal",
            label: "Customer acknowledgement received",
            matched: false,
            name: "customer_ack_received",
          },
          {
            kind: "timer",
            label: "Close case timeout reached",
            matched: false,
            name: "close_case_timeout",
          },
        ],
        timers: [
          {
            afterSeconds: 1800,
            anchor: { kind: "wait_started_at" },
            fired: false,
            matched: false,
            name: "close_case_timeout",
          },
        ],
      },
      waitReason: "dependencies_and_wait_condition",
      workflowStagedAt: startedAt,
    }),
  ];
};

const buildToggleTasks = (resolved: boolean): WorkflowTask[] => {
  const startedAt = recentWorkflowStart(15);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 41,
        state: JobState.Completed,
        task: "collect_inputs",
        waitReason: "none",
        workflowStagedAt: startedAt,
      }),
      {
        attemptedAt: add(startedAt, { seconds: 1 }),
        finalizedAt: add(startedAt, { seconds: 2 }),
        scheduledAt: startedAt,
      },
    ),
    resolved
      ? withTimestamps(
          workflowJobFactory.build({
            deps: ["collect_inputs"],
            id: 42,
            state: JobState.Completed,
            task: "await_review",
            wait: {
              asOf: add(startedAt, { seconds: 8 }),
              attempt: 1,
              exprCel: "approval_received",
              phase: "resolved",
              resolvedAt: add(startedAt, { seconds: 8 }),
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
              startedAt: add(startedAt, { seconds: 2 }),
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
            },
            waitReason: "none",
            workflowStagedAt: startedAt,
          }),
          {
            attemptedAt: add(startedAt, { seconds: 9 }),
            finalizedAt: add(startedAt, { seconds: 10 }),
            scheduledAt: add(startedAt, { seconds: 2 }),
          },
        )
      : workflowJobFactory.build({
          deps: ["collect_inputs"],
          id: 42,
          state: JobState.Pending,
          task: "await_review",
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
            startedAt: add(startedAt, { seconds: 2 }),
            summary: "Waiting for human approval.",
            terms: [
              {
                kind: "signal",
                label: "Human approval received",
                matched: false,
                name: "approval_received",
              },
            ],
            timers: [],
          },
          waitReason: "wait_condition",
          workflowStagedAt: startedAt,
        }),
    workflowJobFactory.build({
      deps: ["await_review"],
      id: 43,
      state: JobState.Pending,
      task: "send_response",
      waitReason: "dependencies",
      workflowStagedAt: startedAt,
    }),
  ];
};

const meta: Meta<typeof WorkflowDiagram> = {
  component: WorkflowDiagram,
  parameters: {
    layout: "fullscreen",
  },
  title: "Components/WorkflowDiagram",
};

export default meta;

type Story = StoryObj<typeof WorkflowDiagram>;

const StatefulRender = ({
  initialSelectedJobId,
  tasks,
}: {
  initialSelectedJobId?: bigint;
  tasks: WorkflowTask[];
}) => {
  const [selectedJobId, setSelectedJobId] = useState<bigint | undefined>(
    initialSelectedJobId ?? tasks[0]?.id,
  );

  return (
    <div className="h-[680px] w-full">
      <WorkflowDiagram
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        tasks={tasks}
      />
    </div>
  );
};

const WaitConditionToggleRender = () => {
  const [resolved, setResolved] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<bigint | undefined>(42n);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setResolved((current) => !current);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="h-[680px] w-full">
      <div className="mb-2 px-4 text-sm text-slate-500 dark:text-slate-400">
        Wait condition is{" "}
        <span className="font-semibold">
          {resolved ? "resolved" : "waiting"}
        </span>{" "}
        and toggles every 5s.
      </div>
      <WorkflowDiagram
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        tasks={buildToggleTasks(resolved)}
      />
    </div>
  );
};

export const Baseline: Story = {
  render: () => (
    <StatefulRender initialSelectedJobId={2n} tasks={buildBaselineTasks()} />
  ),
};

export const WaitingOnWaitCondition: Story = {
  render: () => (
    <StatefulRender
      initialSelectedJobId={33n}
      tasks={buildResolvedAndWaitingTasks()}
    />
  ),
};

export const Resolved: Story = {
  render: () => (
    <StatefulRender
      initialSelectedJobId={32n}
      tasks={buildResolvedAndWaitingTasks()}
    />
  ),
};

export const WaitConditionsResolvedAndWaiting: Story = {
  render: () => (
    <StatefulRender
      initialSelectedJobId={33n}
      tasks={buildResolvedAndWaitingTasks()}
    />
  ),
};

export const AgentCustomerResolutionLarge: Story = {
  render: () => (
    <StatefulRender
      initialSelectedJobId={113n}
      tasks={buildAgentCustomerResolutionTasks()}
    />
  ),
};

export const WaitConditionTransitionAnimation: Story = {
  name: "Wait Condition Transition Animation",
  render: WaitConditionToggleRender,
};

import type { WorkflowTask } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { add, sub } from "date-fns";
import { useEffect, useState } from "react";

import WorkflowDiagram from "./WorkflowDiagram";

// Helpers to produce realistic timestamps anchored to "now" so durations
// displayed inside WorkflowNode look plausible in Storybook.
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
  const T = recentWorkflowStart(12);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 1,
        state: JobState.Completed,
        task: "classify_intake",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 0.5 }),
        finalizedAt: add(T, { seconds: 3 }),
        scheduledAt: T,
      },
    ),
    workflowJobFactory.build({
      deps: ["classify_intake"],
      id: 2,
      state: JobState.Pending,
      task: "compose_draft_response",
      workflowStagedAt: T,
    }),
    workflowJobFactory.build({
      deps: ["compose_draft_response"],
      id: 3,
      state: JobState.Pending,
      task: "send_response",
      workflowStagedAt: T,
    }),
  ];
};

const buildGateOpenAndClosedTasks = (): WorkflowTask[] => {
  const T = recentWorkflowStart(20);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 31,
        state: JobState.Completed,
        task: "collect_inputs",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 0.5 }),
        finalizedAt: add(T, { seconds: 2 }),
        scheduledAt: T,
      },
    ),
    withTimestamps(
      workflowJobFactory.build({
        deps: ["collect_inputs"],
        gate: {
          declaredSignals: ["approval"],
          enabled: true,
          exprCel: 'signals["approval"].size() > 0',
          phase: "satisfied",
          satisfiedAt: add(T, { seconds: 10 }),
          timers: [],
        },
        id: 32,
        state: JobState.Completed,
        task: "review_gate_satisfied",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 10 }),
        finalizedAt: add(T, { seconds: 12 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    workflowJobFactory.build({
      deps: ["review_gate_satisfied"],
      gate: {
        declaredSignals: ["final_sign_off"],
        enabled: true,
        exprCel: 'signals["final_sign_off"].size() > 0',
        phase: "waiting",
        timers: [],
      },
      id: 33,
      state: JobState.Pending,
      task: "publish_gate_pending",
      workflowStagedAt: T,
    }),
  ];
};

const buildAgentCustomerResolutionTasks = (): WorkflowTask[] => {
  const T = recentWorkflowStart(30);

  return [
    // plan_execution: completed in 1.5s
    withTimestamps(
      workflowJobFactory.build({
        deps: [],
        id: 106,
        state: JobState.Completed,
        task: "plan_execution",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 0.5 }),
        finalizedAt: add(T, { seconds: 2 }),
        scheduledAt: T,
      },
    ),
    // call_billing_tool: completed in 1s
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 107,
        state: JobState.Completed,
        task: "call_billing_tool",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        finalizedAt: add(T, { seconds: 3.5 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    // call_crm_tool: completed in 0.5s
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 108,
        state: JobState.Completed,
        task: "call_crm_tool",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        finalizedAt: add(T, { seconds: 3 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    // call_entitlements_tool: completed in 3s
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 109,
        state: JobState.Completed,
        task: "call_entitlements_tool",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        finalizedAt: add(T, { seconds: 5.5 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    // call_risk_tool: running for ~27s
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 110,
        state: JobState.Running,
        task: "call_risk_tool",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    // compose_draft_response: available, gate satisfied
    workflowJobFactory.build({
      deps: ["call_billing_tool", "call_crm_tool", "call_entitlements_tool"],
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: "true",
        phase: "satisfied",
        satisfiedAt: add(T, { seconds: 5.5 }),
        timers: [],
      },
      id: 111,
      state: JobState.Available,
      task: "compose_draft_response",
      workflowStagedAt: T,
    }),
    // send_response: pending, waiting on deps + gate
    workflowJobFactory.build({
      deps: ["call_risk_tool", "compose_draft_response", "plan_execution"],
      gate: {
        declaredSignals: ["request_human_approval"],
        enabled: true,
        exprCel: 'signals["request_human_approval"].size() > 0',
        phase: "waiting",
        timers: [
          { hasAfter: false, hasFireAt: false, name: "review_sla_timeout" },
        ],
      },
      id: 113,
      state: JobState.Pending,
      task: "send_response",
      workflowStagedAt: T,
    }),
    // queue_follow_up_survey: pending, waiting on deps + gate
    workflowJobFactory.build({
      deps: ["send_response"],
      gate: {
        declaredSignals: [],
        enabled: true,
        exprCel: 'timers["follow_up_survey_delay"].fired',
        phase: "waiting",
        timers: [
          {
            hasAfter: false,
            hasFireAt: false,
            name: "follow_up_survey_delay",
          },
        ],
      },
      id: 114,
      state: JobState.Pending,
      task: "queue_follow_up_survey",
      workflowStagedAt: T,
    }),
    // sync_crm_case_notes: pending
    workflowJobFactory.build({
      deps: ["send_response"],
      id: 115,
      state: JobState.Pending,
      task: "sync_crm_case_notes",
      workflowStagedAt: T,
    }),
    // write_resolution_analytics: pending
    workflowJobFactory.build({
      deps: ["send_response"],
      id: 116,
      state: JobState.Pending,
      task: "write_resolution_analytics",
      workflowStagedAt: T,
    }),
    // retry_charge_lookup: retryable, next retry in 15m
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 118,
        state: JobState.Retryable,
        task: "retry_charge_lookup",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        scheduledAt: add(new Date(), { minutes: 15 }),
      },
    ),
    // schedule_manual_review_ping: scheduled for 5m from now
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 119,
        state: JobState.Scheduled,
        task: "schedule_manual_review_ping",
        workflowStagedAt: T,
      }),
      { scheduledAt: add(new Date(), { minutes: 5 }) },
    ),
    // discard_stale_context_refresh: discarded
    withTimestamps(
      workflowJobFactory.build({
        deps: ["plan_execution"],
        id: 120,
        state: JobState.Discarded,
        task: "discard_stale_context_refresh",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 2.5 }),
        finalizedAt: add(T, { seconds: 3 }),
        scheduledAt: add(T, { seconds: 2 }),
      },
    ),
    // close_case: pending, waiting on deps + gate
    workflowJobFactory.build({
      deps: [
        "send_response",
        "sync_crm_case_notes",
        "write_resolution_analytics",
      ],
      gate: {
        declaredSignals: ["request_customer_ack"],
        enabled: true,
        exprCel: 'signals["request_customer_ack"].size() > 0',
        phase: "waiting",
        timers: [
          { hasAfter: false, hasFireAt: false, name: "close_case_timeout" },
        ],
      },
      id: 117,
      state: JobState.Pending,
      task: "close_case",
      workflowStagedAt: T,
    }),
  ];
};

const meta: Meta<typeof WorkflowDiagram> = {
  component: WorkflowDiagram,
  title: "Components/WorkflowDiagram",
};

export default meta;

type Story = StoryObj<typeof WorkflowDiagram>;

const StatefulRender = (args: Story["args"]) => {
  const [selected, setSelected] = useState<bigint | undefined>(
    args?.selectedJobId,
  );

  return (
    <div className="h-[680px] w-full">
      <WorkflowDiagram
        selectedJobId={selected}
        setSelectedJobId={setSelected}
        tasks={args?.tasks || []}
      />
    </div>
  );
};

export const Baseline: Story = {
  args: {
    selectedJobId: 2n,
    setSelectedJobId: () => {},
    tasks: buildBaselineTasks(),
  },
  render: StatefulRender,
};

export const GateOpenAndClosed: Story = {
  args: {
    selectedJobId: 33n,
    setSelectedJobId: () => {},
    tasks: buildGateOpenAndClosedTasks(),
  },
  name: "Gates — Open + Closed",
  render: StatefulRender,
};

export const AgentCustomerResolutionLarge: Story = {
  args: {
    selectedJobId: 113n,
    setSelectedJobId: () => {},
    tasks: buildAgentCustomerResolutionTasks(),
  },
  render: StatefulRender,
};

// ---------------------------------------------------------------------------
// Animated story: gate toggles between waiting and satisfied every 5 seconds
// ---------------------------------------------------------------------------

const makeToggleTasks = (satisfied: boolean): WorkflowTask[] => {
  const T = recentWorkflowStart(15);

  return [
    withTimestamps(
      workflowJobFactory.build({
        id: 41,
        state: JobState.Completed,
        task: "collect_inputs",
        workflowStagedAt: T,
      }),
      {
        attemptedAt: add(T, { seconds: 0.5 }),
        finalizedAt: add(T, { seconds: 2 }),
        scheduledAt: T,
      },
    ),
    satisfied
      ? withTimestamps(
          workflowJobFactory.build({
            deps: ["collect_inputs"],
            gate: {
              declaredSignals: ["approval"],
              enabled: true,
              exprCel: 'signals["approval"].size() > 0',
              phase: "satisfied",
              satisfiedAt: add(T, { seconds: 8 }),
              timers: [],
            },
            id: 42,
            state: JobState.Completed,
            task: "gated_task",
            workflowStagedAt: T,
          }),
          {
            attemptedAt: add(T, { seconds: 8 }),
            finalizedAt: add(T, { seconds: 10 }),
            scheduledAt: add(T, { seconds: 2 }),
          },
        )
      : workflowJobFactory.build({
          deps: ["collect_inputs"],
          gate: {
            declaredSignals: ["approval"],
            enabled: true,
            exprCel: 'signals["approval"].size() > 0',
            phase: "waiting",
            timers: [],
          },
          id: 42,
          state: JobState.Pending,
          task: "gated_task",
          workflowStagedAt: T,
        }),
    workflowJobFactory.build({
      deps: ["gated_task"],
      id: 43,
      state: JobState.Pending,
      task: "downstream_task",
      workflowStagedAt: T,
    }),
  ];
};

const GateToggleRender = () => {
  const [satisfied, setSatisfied] = useState(false);
  const [selected, setSelected] = useState<bigint | undefined>(42n);

  useEffect(() => {
    const interval = setInterval(() => {
      setSatisfied((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const tasks = makeToggleTasks(satisfied);

  return (
    <div className="h-[680px] w-full">
      <div className="mb-2 px-4 text-sm text-slate-500">
        Gate is{" "}
        <span className="font-semibold">
          {satisfied ? "satisfied (closed)" : "waiting (open)"}
        </span>{" "}
        — toggles every 5s
      </div>
      <WorkflowDiagram
        selectedJobId={selected}
        setSelectedJobId={setSelected}
        tasks={tasks}
      />
    </div>
  );
};

export const GateTransitionAnimation: Story = {
  name: "Gate Transition Animation",
  render: GateToggleRender,
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { useEffect, useState } from "react";

import WorkflowDiagram from "./WorkflowDiagram";

const baselineTasks = [
  workflowJobFactory.build({
    id: 1,
    state: JobState.Completed,
    task: "classify_intake",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 2,
    state: JobState.Pending,
    task: "compose_draft_response",
    waitReason: "dependencies",
  }),
  workflowJobFactory.build({
    deps: ["compose_draft_response"],
    id: 3,
    state: JobState.Pending,
    task: "send_response",
    waitReason: "dependencies",
  }),
];

const gateOpenAndClosedTasks = [
  workflowJobFactory.build({
    id: 31,
    state: JobState.Completed,
    task: "collect_inputs",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["collect_inputs"],
    gate: {
      declaredSignals: ["approval"],
      enabled: true,
      exprCel: 'signals["approval"].size() > 0',
      phase: "satisfied",
      satisfiedAt: new Date(),
      timers: [],
    },
    id: 32,
    state: JobState.Completed,
    task: "review_gate_satisfied",
    waitReason: "none",
  }),
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
    waitReason: "gate",
  }),
];

const agentCustomerResolutionTasks = [
  workflowJobFactory.build({
    id: 101,
    state: JobState.Completed,
    task: "classify_intake",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 102,
    state: JobState.Completed,
    task: "fetch_account_context",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 103,
    state: JobState.Completed,
    task: "fetch_entitlements",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 104,
    state: JobState.Completed,
    task: "fetch_recent_charges",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 105,
    state: JobState.Completed,
    task: "retrieve_knowledge",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: [
      "classify_intake",
      "fetch_account_context",
      "fetch_entitlements",
      "fetch_recent_charges",
      "retrieve_knowledge",
    ],
    id: 106,
    state: JobState.Completed,
    task: "plan_execution",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 107,
    state: JobState.Completed,
    task: "call_billing_tool",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 108,
    state: JobState.Completed,
    task: "call_crm_tool",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 109,
    state: JobState.Completed,
    task: "call_entitlements_tool",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 110,
    state: JobState.Running,
    task: "call_risk_tool",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["call_billing_tool", "call_crm_tool", "call_entitlements_tool"],
    gate: {
      declaredSignals: [],
      enabled: true,
      exprCel: "true",
      phase: "satisfied",
      timers: [],
    },
    id: 111,
    state: JobState.Completed,
    task: "compose_draft_response",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["call_risk_tool", "compose_draft_response", "plan_execution"],
    id: 112,
    state: JobState.Completed,
    task: "verify_draft",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["verify_draft"],
    gate: {
      declaredSignals: ["request_human_approval"],
      enabled: true,
      exprCel: 'signals["request_human_approval"].size() > 0',
      phase: "waiting",
      timers: [
        {
          hasAfter: false,
          hasFireAt: false,
          name: "review_sla_timeout",
        },
      ],
    },
    id: 113,
    state: JobState.Pending,
    task: "send_response",
    waitReason: "gate",
  }),
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
    waitReason: "dependencies_and_gate",
  }),
  workflowJobFactory.build({
    deps: ["send_response"],
    id: 115,
    state: JobState.Pending,
    task: "sync_crm_case_notes",
    waitReason: "dependencies",
  }),
  workflowJobFactory.build({
    deps: ["send_response"],
    id: 116,
    state: JobState.Pending,
    task: "write_resolution_analytics",
    waitReason: "dependencies",
  }),
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
        {
          hasAfter: false,
          hasFireAt: false,
          name: "close_case_timeout",
        },
      ],
    },
    id: 117,
    state: JobState.Pending,
    task: "close_case",
    waitReason: "dependencies_and_gate",
  }),
];

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
    tasks: baselineTasks,
  },
  render: StatefulRender,
};

export const GateOpenAndClosed: Story = {
  args: {
    selectedJobId: 33n,
    setSelectedJobId: () => {},
    tasks: gateOpenAndClosedTasks,
  },
  name: "Gates — Open + Closed",
  render: StatefulRender,
};

export const AgentCustomerResolutionLarge: Story = {
  args: {
    selectedJobId: 113n,
    setSelectedJobId: () => {},
    tasks: agentCustomerResolutionTasks,
  },
  render: StatefulRender,
};

// ---------------------------------------------------------------------------
// Animated story: gate toggles between waiting and satisfied every 5 seconds
// ---------------------------------------------------------------------------

const makeToggleTasks = (satisfied: boolean) => [
  workflowJobFactory.build({
    id: 41,
    state: JobState.Completed,
    task: "collect_inputs",
    waitReason: "none",
  }),
  workflowJobFactory.build({
    deps: ["collect_inputs"],
    gate: {
      declaredSignals: ["approval"],
      enabled: true,
      exprCel: 'signals["approval"].size() > 0',
      phase: satisfied ? "satisfied" : "waiting",
      satisfiedAt: satisfied ? new Date() : undefined,
      timers: [],
    },
    id: 42,
    state: satisfied ? JobState.Completed : JobState.Pending,
    task: "gated_task",
    waitReason: satisfied ? "none" : "gate",
  }),
  workflowJobFactory.build({
    deps: ["gated_task"],
    id: 43,
    state: JobState.Pending,
    task: "downstream_task",
    waitReason: "dependencies",
  }),
];

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

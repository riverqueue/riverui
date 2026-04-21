import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { useState } from "react";

import WorkflowDetail from "./WorkflowDetail";

const buildWorkflow = () => {
  const classify = workflowJobFactory.build({
    id: 1001,
    state: JobState.Completed,
    task: "classify_intake",
    waitReason: "none",
  });
  const compose = workflowJobFactory.build({
    deps: ["classify_intake"],
    gate: {
      declaredSignals: ["approval.received"],
      enabled: true,
      exprCel:
        'signals["approval.received"].size() > 0 || timers["escalation"].fired',
      phase: "waiting",
      timers: [
        {
          hasAfter: false,
          hasFireAt: false,
          name: "escalation",
        },
      ],
    },
    id: 1002,
    state: JobState.Pending,
    task: "compose_draft_response",
    waitReason: "gate",
  });
  const send = workflowJobFactory.build({
    deps: ["compose_draft_response"],
    id: 1003,
    state: JobState.Pending,
    task: "send_response",
    waitReason: "dependencies",
  });

  return {
    id: "wf-story-gate-blocked",
    name: "Customer Intake Workflow",
    tasks: [classify, compose, send],
  };
};

const buildTimerWorkflow = () => {
  const dependency = workflowJobFactory.build({
    id: 2001,
    state: JobState.Completed,
    task: "fetch_customer_profile",
    waitReason: "none",
  });
  const gated = workflowJobFactory.build({
    deps: ["fetch_customer_profile"],
    gate: {
      declaredSignals: [],
      enabled: true,
      exprCel: 'timers["timeout_30m"].fired',
      phase: "waiting",
      timers: [
        {
          anchor: {
            kind: "gate_active_at",
          },
          fireAt: new Date("2026-01-01T01:00:00.000Z"),
          hasAfter: false,
          hasFireAt: true,
          name: "timeout_30m",
        },
      ],
    },
    id: 2002,
    state: JobState.Pending,
    task: "compose_draft_response",
    waitReason: "gate",
  });

  return {
    id: "wf-story-timer-blocked",
    name: "Timer-Gated Workflow",
    tasks: [dependency, gated],
  };
};

const buildSatisfiedGateWorkflow = () => {
  const dependency = workflowJobFactory.build({
    id: 3001,
    state: JobState.Completed,
    task: "collect_inputs",
    waitReason: "none",
  });
  const gated = workflowJobFactory.build({
    deps: ["collect_inputs"],
    gate: {
      declaredSignals: ["approval.received"],
      enabled: true,
      exprCel: 'signals["approval.received"].size() > 0',
      phase: "satisfied",
      satisfaction: {
        asOf: new Date("2026-01-01T00:45:00.000Z"),
        attempt: 1,
        signals: [
          {
            count: 1,
            key: "approval.received",
            lastSignalId: 901n,
          },
        ],
        timers: [],
      },
      satisfiedAt: new Date("2026-01-01T00:45:00.000Z"),
      timers: [],
    },
    id: 3002,
    state: JobState.Available,
    task: "compose_draft_response",
    waitReason: "none",
  });

  return {
    id: "wf-story-gate-satisfied",
    name: "Satisfied Gate Workflow",
    tasks: [dependency, gated],
  };
};

const buildAgentCustomerResolutionWorkflow = () => {
  const classify = workflowJobFactory.build({
    id: 4001,
    state: JobState.Completed,
    task: "classify_intake",
    waitReason: "none",
  });
  const fetchAccountContext = workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 4002,
    state: JobState.Completed,
    task: "fetch_account_context",
    waitReason: "none",
  });
  const fetchEntitlements = workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 4003,
    state: JobState.Completed,
    task: "fetch_entitlements",
    waitReason: "none",
  });
  const fetchRecentCharges = workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 4004,
    state: JobState.Completed,
    task: "fetch_recent_charges",
    waitReason: "none",
  });
  const retrieveKnowledge = workflowJobFactory.build({
    deps: ["classify_intake"],
    id: 4005,
    state: JobState.Completed,
    task: "retrieve_knowledge",
    waitReason: "none",
  });
  const planExecution = workflowJobFactory.build({
    deps: [
      "classify_intake",
      "fetch_account_context",
      "fetch_entitlements",
      "fetch_recent_charges",
      "retrieve_knowledge",
    ],
    id: 4006,
    state: JobState.Completed,
    task: "plan_execution",
    waitReason: "none",
  });
  const callBilling = workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 4007,
    state: JobState.Completed,
    task: "call_billing_tool",
    waitReason: "none",
  });
  const callCRM = workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 4008,
    state: JobState.Completed,
    task: "call_crm_tool",
    waitReason: "none",
  });
  const callEntitlements = workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 4009,
    state: JobState.Completed,
    task: "call_entitlements_tool",
    waitReason: "none",
  });
  const callRisk = workflowJobFactory.build({
    deps: ["plan_execution"],
    id: 4010,
    state: JobState.Running,
    task: "call_risk_tool",
    waitReason: "none",
  });
  const composeDraft = workflowJobFactory.build({
    deps: ["call_billing_tool", "call_crm_tool", "call_entitlements_tool"],
    gate: {
      declaredSignals: [],
      enabled: true,
      exprCel: "true",
      phase: "satisfied",
      timers: [],
    },
    id: 4011,
    state: JobState.Completed,
    task: "compose_draft_response",
    waitReason: "none",
  });
  const verifyDraft = workflowJobFactory.build({
    deps: ["call_risk_tool", "compose_draft_response", "plan_execution"],
    id: 4012,
    state: JobState.Completed,
    task: "verify_draft",
    waitReason: "none",
  });
  const sendResponse = workflowJobFactory.build({
    deps: ["verify_draft"],
    gate: {
      declaredSignals: ["request_human_approval"],
      enabled: true,
      exprCel:
        'signals["request_human_approval"].size() > 0 || timers["review_sla_timeout"].fired',
      phase: "waiting",
      timers: [
        {
          hasAfter: false,
          hasFireAt: false,
          name: "review_sla_timeout",
        },
      ],
    },
    id: 4013,
    state: JobState.Pending,
    task: "send_response",
    waitReason: "gate",
  });
  const queueSurvey = workflowJobFactory.build({
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
    id: 4014,
    state: JobState.Pending,
    task: "queue_follow_up_survey",
    waitReason: "dependencies_and_gate",
  });
  const syncCRMCaseNotes = workflowJobFactory.build({
    deps: ["send_response"],
    id: 4015,
    state: JobState.Pending,
    task: "sync_crm_case_notes",
    waitReason: "dependencies",
  });
  const writeResolutionAnalytics = workflowJobFactory.build({
    deps: ["send_response"],
    id: 4016,
    state: JobState.Pending,
    task: "write_resolution_analytics",
    waitReason: "dependencies",
  });
  const closeCase = workflowJobFactory.build({
    deps: [
      "send_response",
      "sync_crm_case_notes",
      "write_resolution_analytics",
    ],
    gate: {
      declaredSignals: ["request_customer_ack"],
      enabled: true,
      exprCel:
        'signals["request_customer_ack"].size() > 0 || timers["close_case_timeout"].fired',
      phase: "waiting",
      timers: [
        {
          hasAfter: false,
          hasFireAt: false,
          name: "close_case_timeout",
        },
      ],
    },
    id: 4017,
    state: JobState.Pending,
    task: "close_case",
    waitReason: "dependencies_and_gate",
  });

  return {
    id: "wf-story-agent-customer-resolution",
    name: "Agent Customer Resolution Workflow",
    tasks: [
      classify,
      fetchAccountContext,
      fetchEntitlements,
      fetchRecentCharges,
      retrieveKnowledge,
      planExecution,
      callBilling,
      callCRM,
      callEntitlements,
      callRisk,
      composeDraft,
      verifyDraft,
      sendResponse,
      queueSurvey,
      syncCRMCaseNotes,
      writeResolutionAnalytics,
      closeCase,
    ],
  };
};

const meta: Meta<typeof WorkflowDetail> = {
  component: WorkflowDetail,
  parameters: {
    features: {
      workflowQueries: true,
    },
    layout: "fullscreen",
    router: {
      initialEntries: ["/"],
      routes: ["/", "/jobs/$jobId"],
    },
  },
  title: "Pages/WorkflowDetail",
};

export default meta;

type Story = StoryObj<typeof WorkflowDetail>;

const normalizeSelectedJobId = (
  selectedJobId: bigint | number | string | undefined,
): bigint | undefined => {
  if (typeof selectedJobId === "bigint") return selectedJobId;
  if (typeof selectedJobId === "number") return BigInt(selectedJobId);
  if (typeof selectedJobId === "string" && selectedJobId.length > 0) {
    try {
      return BigInt(selectedJobId);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const StatefulStory = ({ args }: { args: Story["args"] }) => {
  const [selectedJobId, setSelectedJobId] = useState<bigint | undefined>(
    normalizeSelectedJobId(args?.selectedJobId),
  );

  return (
    <div className="min-h-[1700px] bg-white dark:bg-slate-950">
      <WorkflowDetail
        cancelPending={args?.cancelPending}
        loading={false}
        onCancel={() => {}}
        onRetry={() => {}}
        retryPending={args?.retryPending}
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        workflow={args?.workflow}
      />
    </div>
  );
};

const StatefulRender = (args: Story["args"]) => {
  return (
    <StatefulStory
      args={args}
      key={`${args?.workflow?.id ?? "workflow"}-${args?.selectedJobId?.toString() ?? "none"}`}
    />
  );
};

export const GateBlockedSelectedTask: Story = {
  args: {
    selectedJobId: 1002n,
    workflow: buildWorkflow(),
  },
  render: StatefulRender,
};

export const TimerBlockedSelectedTask: Story = {
  args: {
    selectedJobId: 2002n,
    workflow: buildTimerWorkflow(),
  },
  render: StatefulRender,
};

export const GateSatisfiedSelectedTask: Story = {
  args: {
    selectedJobId: 3002n,
    workflow: buildSatisfiedGateWorkflow(),
  },
  render: StatefulRender,
};

export const AgentCustomerResolutionInteractive: Story = {
  args: {
    selectedJobId: undefined,
    workflow: buildAgentCustomerResolutionWorkflow(),
  },
  render: StatefulRender,
};

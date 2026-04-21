import type { WorkflowTaskGate } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { add, sub } from "date-fns";

import WorkflowGateInspector from "./WorkflowGateInspector";

const now = new Date();

const waitingOnSignalGate: WorkflowTaskGate = {
  activeAt: sub(now, { minutes: 3 }),
  declaredSignals: [
    "reviewer.approved",
    "reviewer.override",
    "reviewer.escalated",
  ],
  enabled: true,
  exprCel:
    'signals["reviewer.approved"].size() > 0 || signals["reviewer.override"].size() > 0 || timers["review_timeout"].fired',
  phase: "waiting",
  timers: [
    {
      afterSeconds: 900,
      anchor: { kind: "gate_active_at" },
      fireAt: add(now, { minutes: 12 }),
      hasAfter: true,
      hasFireAt: true,
      name: "review_timeout",
    },
  ],
};

const timerHeavyGate: WorkflowTaskGate = {
  activeAt: sub(now, { minutes: 18 }),
  declaredSignals: [],
  enabled: true,
  exprCel:
    'timers["soft_timeout"].fired || timers["hard_timeout"].fired || timers["customer_follow_up"].fired',
  phase: "waiting",
  timers: [
    {
      afterSeconds: 300,
      anchor: { kind: "gate_active_at" },
      fireAt: sub(now, { minutes: 13 }),
      hasAfter: true,
      hasFireAt: true,
      name: "soft_timeout",
    },
    {
      afterSeconds: 900,
      anchor: { kind: "gate_active_at" },
      fireAt: add(now, { minutes: 2 }),
      hasAfter: true,
      hasFireAt: true,
      name: "hard_timeout",
    },
    {
      afterSeconds: 1800,
      anchor: { kind: "dep_finalized_at", task: "send_response" },
      hasAfter: true,
      hasFireAt: false,
      name: "customer_follow_up",
    },
  ],
};

const satisfiedGate: WorkflowTaskGate = {
  activeAt: sub(now, { minutes: 26 }),
  declaredSignals: ["approval.received", "approval.override"],
  enabled: true,
  exprCel:
    'signals["approval.received"].size() > 0 || signals["approval.override"].size() > 0 || timers["approval_timeout"].fired',
  phase: "satisfied",
  satisfaction: {
    asOf: sub(now, { minutes: 2 }),
    attempt: 1,
    signals: [
      {
        count: 2,
        key: "approval.received",
        lastSignalId: 9123n,
      },
    ],
    timers: [
      {
        fireAt: add(now, { minutes: 4 }),
        fired: false,
        name: "approval_timeout",
      },
    ],
  },
  satisfiedAt: sub(now, { minutes: 2 }),
  timers: [
    {
      afterSeconds: 1800,
      anchor: { kind: "gate_active_at" },
      fireAt: add(now, { minutes: 4 }),
      hasAfter: true,
      hasFireAt: true,
      name: "approval_timeout",
    },
  ],
};

const meta: Meta<typeof WorkflowGateInspector> = {
  component: WorkflowGateInspector,
  parameters: {
    layout: "centered",
  },
  title: "Components/WorkflowGateInspector",
};

export default meta;

type Story = StoryObj<typeof WorkflowGateInspector>;

const renderCard = (args: Story["args"]) => {
  return (
    <div className="w-[720px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <WorkflowGateInspector {...args} />
    </div>
  );
};

export const WaitingOnSignals: Story = {
  args: {
    gate: waitingOnSignalGate,
    waitReason: "gate",
  },
  render: renderCard,
};

export const TimerHeavy: Story = {
  args: {
    gate: timerHeavyGate,
    waitReason: "dependencies_and_gate",
  },
  render: renderCard,
};

export const SatisfiedSnapshot: Story = {
  args: {
    gate: satisfiedGate,
    waitReason: "none",
  },
  render: renderCard,
};

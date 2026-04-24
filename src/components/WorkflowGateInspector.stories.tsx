import type { WorkflowTaskWait } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { add, sub } from "date-fns";

import WorkflowGateInspector from "./WorkflowGateInspector";

const now = new Date();

const waitingOnSignals: WorkflowTaskWait = {
  exprCel: "approval_received || manager_override || review_timeout_reached",
  phase: "waiting",
  signals: [
    {
      key: "approval.received",
      matched: false,
      matchedCount: 0,
      visibleCount: 0,
    },
    {
      key: "manager.override",
      matched: false,
      matchedCount: 0,
      visibleCount: 0,
    },
  ],
  startedAt: sub(now, { minutes: 3 }),
  summary: "Waiting for human approval, manager override, or review timeout.",
  terms: [
    {
      exprCel: `payload.approved == true`,
      kind: "signal",
      label: "Human approval received",
      matched: false,
      name: "approval_received",
    },
    {
      exprCel: `payload.manager_override == true`,
      kind: "signal",
      label: "Manager override received",
      matched: false,
      name: "manager_override",
    },
    {
      kind: "timer",
      label: "Review timeout reached",
      matched: false,
      name: "review_timeout_reached",
    },
  ],
  timers: [
    {
      afterSeconds: 900,
      anchor: { kind: "wait_started_at" },
      fireAt: add(now, { minutes: 12 }),
      fired: false,
      matched: false,
      name: "review_timeout",
    },
  ],
};

const timerHeavyWait: WorkflowTaskWait = {
  exprCel:
    "soft_timeout_reached || hard_timeout_reached || customer_follow_up_reached",
  phase: "waiting",
  signals: [],
  startedAt: sub(now, { minutes: 18 }),
  terms: [
    {
      kind: "timer",
      label: "Soft timeout reached",
      matched: true,
      name: "soft_timeout_reached",
    },
    {
      kind: "timer",
      label: "Hard timeout reached",
      matched: false,
      name: "hard_timeout_reached",
    },
    {
      kind: "timer",
      label: "Customer follow-up reached",
      matched: false,
      name: "customer_follow_up_reached",
    },
  ],
  timers: [
    {
      afterSeconds: 300,
      anchor: { kind: "wait_started_at" },
      fireAt: sub(now, { minutes: 13 }),
      fired: true,
      matched: true,
      name: "soft_timeout",
    },
    {
      afterSeconds: 900,
      anchor: { kind: "wait_started_at" },
      fireAt: add(now, { minutes: 2 }),
      fired: false,
      matched: false,
      name: "hard_timeout",
    },
    {
      afterSeconds: 1800,
      anchor: { kind: "task_finalized_at", task: "send_response" },
      fired: false,
      matched: false,
      name: "customer_follow_up",
    },
  ],
};

const resolvedWait: WorkflowTaskWait = {
  asOf: sub(now, { minutes: 2 }),
  attempt: 1,
  exprCel:
    "(risk_checks_clear && approval_received) || approval_override || approval_timeout_reached",
  phase: "resolved",
  resolvedAt: sub(now, { minutes: 2 }),
  signals: [
    {
      key: "approval.received",
      lastMatchedID: 9123n,
      lastVisibleID: 9123n,
      matched: true,
      matchedCount: 2,
      visibleCount: 2,
    },
    {
      key: "approval.override",
      matched: false,
      matchedCount: 0,
      visibleCount: 0,
    },
  ],
  startedAt: sub(now, { minutes: 26 }),
  summary: "Risk checks clear and human approval received",
  terms: [
    {
      exprCel: `output.risk == "clear"`,
      kind: "dependency_output",
      label: "Risk checks clear",
      matched: true,
      name: "risk_checks_clear",
    },
    {
      exprCel: `payload.approved == true`,
      kind: "signal",
      label: "Human approval received",
      matched: true,
      name: "approval_received",
    },
    {
      exprCel: `payload.override == true`,
      kind: "signal",
      label: "Approval override received",
      matched: false,
      name: "approval_override",
    },
    {
      kind: "timer",
      label: "Approval timeout reached",
      matched: false,
      name: "approval_timeout_reached",
    },
  ],
  timers: [
    {
      afterSeconds: 1800,
      anchor: { kind: "wait_started_at" },
      fireAt: add(now, { minutes: 4 }),
      fired: false,
      matched: false,
      name: "approval_timeout",
    },
  ],
};

const meta: Meta<typeof WorkflowGateInspector> = {
  component: WorkflowGateInspector,
  parameters: {
    layout: "padded",
  },
  title: "Components/WorkflowGateInspector",
};

export default meta;

type Story = StoryObj<typeof WorkflowGateInspector>;

export const WaitingOnSignals: Story = {
  args: {
    taskName: "await/review",
    wait: waitingOnSignals,
    workflowID: "wf-story",
  },
};

export const TimerHeavy: Story = {
  args: {
    taskName: "queue/follow-up",
    wait: timerHeavyWait,
    workflowID: "wf-story",
  },
};

export const ResolvedResult: Story = {
  args: {
    taskName: "await/review",
    wait: resolvedWait,
    workflowID: "wf-story",
  },
};

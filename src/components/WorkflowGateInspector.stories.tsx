import type { WorkflowTaskSignal, WorkflowTaskWait } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { add, sub } from "date-fns";
import { userEvent, within } from "storybook/test";

import WorkflowGateInspector, {
  type TaskSignalLoader,
} from "./WorkflowGateInspector";

const now = new Date();

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

const resolvedSignalLoader = createStorySignalLoader({
  "approval.received": {
    evidence: [
      buildSignal({
        createdAt: sub(now, { minutes: 2 }),
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
        createdAt: sub(now, { minutes: 1 }),
        id: 9124n,
        key: "approval.received",
        payload: {
          approved: true,
          reviewer: "manager",
          ticket_id: "approval-9123",
        },
        source: {
          source: "review-console",
          timing: "after-resolution-duplicate",
        },
      }),
      buildSignal({
        createdAt: sub(now, { minutes: 2 }),
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

const allTaskSignalsLoader = createStorySignalLoader({
  "approval.override": {
    history: [
      buildSignal({
        createdAt: sub(now, { seconds: 30 }),
        id: 9125n,
        key: "approval.override",
        payload: {
          override: true,
          reviewer: "director",
          ticket_id: "approval-9125",
        },
        source: {
          source: "admin-console",
        },
      }),
    ],
  },
  "approval.received": {
    evidence: [
      buildSignal({
        createdAt: sub(now, { minutes: 2 }),
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
        createdAt: sub(now, { minutes: 1 }),
        id: 9124n,
        key: "approval.received",
        payload: {
          approved: true,
          reviewer: "manager",
          ticket_id: "approval-9123",
        },
        source: {
          source: "review-console",
          timing: "after-resolution-duplicate",
        },
      }),
      buildSignal({
        createdAt: sub(now, { minutes: 2 }),
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

const waitingOnSignals: WorkflowTaskWait = {
  exprCel: "approval_received || manager_override || review_timeout_reached",
  inputs: {
    deps: [],
    signals: [{ key: "approval.received" }, { key: "manager.override" }],
    timers: [
      {
        afterSeconds: 900,
        anchor: { kind: "wait_started_at" },
        fireAt: add(now, { minutes: 12 }),
        name: "review_timeout",
      },
    ],
  },
  phase: "waiting",
  startedAt: sub(now, { minutes: 3 }),
  summary: "Waiting for human approval, manager override, or review timeout.",
  terms: [
    {
      exprCel: `payload.approved == true`,
      kind: "signal",
      label: "Human approval received",
      name: "approval_received",
      signalKey: "approval.received",
    },
    {
      exprCel: `payload.manager_override == true`,
      kind: "signal",
      label: "Manager override received",
      name: "manager_override",
      signalKey: "manager.override",
    },
    {
      kind: "timer",
      label: "Review timeout reached",
      name: "review_timeout_reached",
      timerName: "review_timeout",
    },
  ],
};

const timerHeavyWait: WorkflowTaskWait = {
  exprCel:
    "soft_timeout_reached || hard_timeout_reached || customer_follow_up_reached",
  inputs: {
    deps: [],
    signals: [],
    timers: [
      {
        afterSeconds: 300,
        anchor: { kind: "wait_started_at" },
        fireAt: sub(now, { minutes: 13 }),
        name: "soft_timeout",
      },
      {
        afterSeconds: 900,
        anchor: { kind: "wait_started_at" },
        fireAt: add(now, { minutes: 2 }),
        name: "hard_timeout",
      },
      {
        afterSeconds: 1800,
        anchor: { kind: "task_finalized_at", task: "send_response" },
        name: "customer_follow_up",
      },
    ],
  },
  phase: "waiting",
  startedAt: sub(now, { minutes: 18 }),
  terms: [
    {
      kind: "timer",
      label: "Soft timeout reached",
      name: "soft_timeout_reached",
      result: { matchedCount: 0, requiredCount: 0, satisfied: true },
      timerName: "soft_timeout",
    },
    {
      kind: "timer",
      label: "Hard timeout reached",
      name: "hard_timeout_reached",
      timerName: "hard_timeout",
    },
    {
      kind: "timer",
      label: "Customer follow-up reached",
      name: "customer_follow_up_reached",
      timerName: "customer_follow_up",
    },
  ],
};

const resolvedWait: WorkflowTaskWait = {
  evidence: {
    evaluatedAt: sub(now, { minutes: 2 }),
    workflowAttempt: 1,
  },
  exprCel:
    "(risk_checks_clear && approval_received) || approval_override || approval_timeout_reached",
  inputs: {
    deps: [{ taskName: "risk_checks" }],
    signals: [
      {
        key: "approval.received",
        result: { includedCount: 2, lastIncludedID: 9123n },
      },
      {
        key: "approval.override",
        result: { includedCount: 0 },
      },
    ],
    timers: [
      {
        afterSeconds: 1800,
        anchor: { kind: "wait_started_at" },
        fireAt: add(now, { minutes: 4 }),
        name: "approval_timeout",
        result: { fireAt: add(now, { minutes: 4 }), fired: false },
      },
    ],
  },
  phase: "resolved",
  resolvedAt: sub(now, { minutes: 2 }),
  startedAt: sub(now, { minutes: 26 }),
  summary: "Risk checks clear and human approval received",
  terms: [
    {
      exprCel: `deps["risk_checks"].output.risk == "clear"`,
      kind: "generic",
      label: "Risk checks clear",
      name: "risk_checks_clear",
      result: { matchedCount: 0, requiredCount: 0, satisfied: true },
    },
    {
      exprCel: `payload.approved == true`,
      kind: "signal",
      label: "Human approval received",
      name: "approval_received",
      result: {
        lastMatchedID: 9123n,
        matchedCount: 2,
        requiredCount: 1,
        satisfied: true,
      },
      signalKey: "approval.received",
    },
    {
      exprCel: `payload.override == true`,
      kind: "signal",
      label: "Approval override received",
      name: "approval_override",
      result: { matchedCount: 0, requiredCount: 1, satisfied: false },
      signalKey: "approval.override",
    },
    {
      kind: "timer",
      label: "Approval timeout reached",
      name: "approval_timeout_reached",
      result: { matchedCount: 0, requiredCount: 0, satisfied: false },
      timerName: "approval_timeout",
    },
  ],
};

const manySignals = Array.from({ length: 43 }, (_, index) => {
  const id = 9300n - BigInt(index);
  const approved = index === 0;

  return buildSignal({
    createdAt: sub(now, { seconds: index * 20 }),
    id,
    key: "approval.received",
    payload: {
      approved,
      request_id: `review-${id.toString()}`,
      reviewer: approved ? "review_lead" : "review_queue",
    },
    source: {
      channel: index % 2 === 0 ? "webhook" : "admin-console",
      sequence: Number(id),
    },
  });
});

const manySignalsLoader = createStorySignalLoader({
  "approval.received": {
    evidence: manySignals,
    history: manySignals,
  },
});

const manySignalsWait: WorkflowTaskWait = {
  ...resolvedWait,
  exprCel: "approval_received || approval_timeout_reached",
  inputs: {
    ...resolvedWait.inputs,
    signals: [
      {
        key: "approval.received",
        result: { includedCount: manySignals.length, lastIncludedID: 9300n },
      },
    ],
  },
  summary: "Approval received after many signal deliveries",
  terms: [
    {
      exprCel: `payload.approved == true`,
      kind: "signal",
      label: "Approval received",
      name: "approval_received",
      result: {
        lastMatchedID: 9300n,
        matchedCount: 1,
        requiredCount: 1,
        satisfied: true,
      },
      signalKey: "approval.received",
    },
    {
      kind: "timer",
      label: "Approval timeout reached",
      name: "approval_timeout_reached",
      result: { matchedCount: 0, requiredCount: 0, satisfied: false },
      timerName: "approval_timeout",
    },
  ],
};

const declaredSignalWithoutTermsWait: WorkflowTaskWait = {
  exprCel: `signals.exists(s, s.key == "approval.received" && s.payload.approved == true)`,
  inputs: {
    deps: [],
    signals: [{ key: "approval.received" }],
    timers: [],
  },
  phase: "waiting",
  startedAt: sub(now, { minutes: 6 }),
  summary: "Waiting for approval signal.",
  terms: [],
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

const openSignalHistory = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);

  await userEvent.click(await canvas.findByRole("button", { name: "Details" }));
  await userEvent.click(
    await canvas.findByRole("button", { name: /Signal evidence/ }),
  );
};

const openAllTaskSignals = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);

  await userEvent.click(await canvas.findByRole("button", { name: "Details" }));
  await userEvent.click(
    await canvas.findByRole("button", { name: "All task signals" }),
  );
};

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
    loadTaskSignals: resolvedSignalLoader,
    taskName: "await/review",
    wait: resolvedWait,
    workflowID: "wf-story",
  },
  play: async ({ canvasElement }) => openSignalHistory(canvasElement),
};

export const ManySignalsReceived: Story = {
  args: {
    loadTaskSignals: manySignalsLoader,
    taskName: "await/review",
    wait: manySignalsWait,
    workflowID: "wf-story",
  },
  play: async ({ canvasElement }) => openSignalHistory(canvasElement),
};

export const DeclaredSignalWithoutTerms: Story = {
  args: {
    loadTaskSignals: manySignalsLoader,
    taskName: "await/review",
    wait: declaredSignalWithoutTermsWait,
    workflowID: "wf-story",
  },
  play: async ({ canvasElement }) => openSignalHistory(canvasElement),
};

export const AllTaskSignals: Story = {
  args: {
    loadTaskSignals: allTaskSignalsLoader,
    taskName: "await/review",
    wait: resolvedWait,
    workflowID: "wf-story",
  },
  play: async ({ canvasElement }) => openAllTaskSignals(canvasElement),
};

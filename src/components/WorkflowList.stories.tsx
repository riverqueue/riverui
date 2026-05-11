import type { WorkflowListItem } from "@services/workflows";
import type { Meta, StoryObj } from "@storybook/react-vite";

import WorkflowList from "./WorkflowList";

const meta: Meta<typeof WorkflowList> = {
  component: WorkflowList,
  parameters: {
    layout: "fullscreen",
    router: {
      routes: ["/", "/workflows", "/workflows/$workflowId"],
    },
  },
  title: "Pages/WorkflowList",
};

export default meta;

type Story = StoryObj<typeof WorkflowList>;

const workflow = (
  id: string,
  name: string,
  createdAt: string,
  counts: Partial<
    Pick<
      WorkflowListItem,
      | "countAvailable"
      | "countCancelled"
      | "countCompleted"
      | "countDiscarded"
      | "countFailedDeps"
      | "countPending"
      | "countRetryable"
      | "countRunning"
      | "countScheduled"
    >
  >,
): WorkflowListItem => ({
  countAvailable: counts.countAvailable ?? 0,
  countCancelled: counts.countCancelled ?? 0,
  countCompleted: counts.countCompleted ?? 0,
  countDiscarded: counts.countDiscarded ?? 0,
  countFailedDeps: counts.countFailedDeps ?? 0,
  countPending: counts.countPending ?? 0,
  countRetryable: counts.countRetryable ?? 0,
  countRunning: counts.countRunning ?? 0,
  countScheduled: counts.countScheduled ?? 0,
  createdAt: new Date(createdAt),
  id,
  name,
});

const workflows: WorkflowListItem[] = [
  workflow("wf-onboarding-2026-05-01", "Customer onboarding", "2026-05-01", {
    countCompleted: 5,
    countPending: 2,
    countRunning: 1,
  }),
  workflow("wf-nightly-ledger-close", "Nightly ledger close", "2026-04-29", {
    countCompleted: 12,
  }),
  workflow("wf-import-retry-queue", "Import retry queue", "2026-04-28", {
    countCompleted: 8,
    countFailedDeps: 1,
  }),
  workflow(
    "wf-backfill-with-a-very-long-identifier-for-layout",
    "Long-running historical backfill with a verbose display name",
    "2026-04-22",
    {
      countCompleted: 21,
      countPending: 4,
      countScheduled: 3,
    },
  ),
];

export const Loading: Story = {
  args: {
    loading: true,
    workflowItems: [],
    workflowQueriesEnabled: true,
  },
};

export const Populated: Story = {
  args: {
    loading: false,
    workflowItems: workflows,
    workflowQueriesEnabled: true,
  },
};

export const NoWorkflows: Story = {
  args: {
    loading: false,
    workflowItems: [],
    workflowQueriesEnabled: true,
  },
};

export const WorkflowsNotEnabled: Story = {
  args: {
    loading: false,
    workflowItems: [],
    workflowQueriesEnabled: false,
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Job } from "@services/jobs";
import { JobState } from "@services/types";
import { jobFactory } from "@test/factories/job";

import JobDetail from "./JobDetail";

const meta: Meta<typeof JobDetail> = {
  component: JobDetail,
  title: "Pages/JobDetail",
};

export default meta;

type Story = StoryObj<typeof JobDetail>;

const visualJob: Job = {
  args: {
    amountCents: 4200,
    customerID: "cus_123",
  },
  attempt: 1,
  attemptedAt: new Date("2025-02-28T12:04:00.000Z"),
  attemptedBy: ["worker-billing-1"],
  createdAt: new Date("2025-02-28T12:00:00.000Z"),
  errors: [],
  finalizedAt: undefined,
  id: BigInt(4242),
  kind: "ChargeCustomer",
  logs: {
    1: "starting execution\ncalling payment provider",
  },
  maxAttempts: 5,
  metadata: {},
  priority: 2,
  queue: "billing",
  scheduledAt: new Date("2025-02-28T12:03:00.000Z"),
  state: JobState.Running,
  tags: ["billing", "critical"],
};

export const Scheduled: Story = {
  args: {
    job: jobFactory.scheduled().build(),
  },
};

export const Available: Story = {
  args: {
    job: jobFactory.available().build(),
  },
};

export const Running: Story = {
  args: {
    job: jobFactory.running().build(),
  },
};

export const Completed: Story = {
  args: {
    job: jobFactory.completed().build(),
  },
};

export const Retryable: Story = {
  args: {
    job: jobFactory.retryable().build(),
  },
};

export const Discarded: Story = {
  args: {
    job: jobFactory.discarded().build(),
  },
};

export const Cancelled: Story = {
  args: {
    job: jobFactory.cancelled().build(),
  },
};

export const VisualRegression: Story = {
  args: {
    cancel: () => {},
    deleteFn: () => {},
    job: visualJob,
    retry: () => {},
  },
  tags: ["visual"],
};

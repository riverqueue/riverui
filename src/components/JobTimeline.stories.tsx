import type { Meta, StoryObj } from "@storybook/react-vite";

import { jobFactory } from "@test/factories/job";
import { sub } from "date-fns";

import JobTimeline from "./JobTimeline";

const meta: Meta<typeof JobTimeline> = {
  component: JobTimeline,
  title: "Components/JobTimeline",
};

export default meta;

type Story = StoryObj<typeof JobTimeline>;

export const Pending: Story = {
  args: {
    job: jobFactory.pending().build(),
  },
};

export const Scheduled: Story = {
  args: {
    job: jobFactory.scheduled().build(),
  },
};

export const ScheduledSnoozed: Story = {
  args: {
    job: jobFactory.scheduledSnoozed().build(),
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

export const RetryableOverdue: Story = {
  args: {
    job: jobFactory
      .retryable()
      .build({ scheduledAt: sub(Date.now(), { minutes: 2, seconds: 30 }) }),
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

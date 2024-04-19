import type { Meta, StoryObj } from "@storybook/react";

import JobTimeline from "./JobTimeline";
import { jobFactory } from "@test/factories/job";

const meta: Meta<typeof JobTimeline> = {
  title: "Components/JobTimeline",
  component: JobTimeline,
};

export default meta;

type Story = StoryObj<typeof JobTimeline>;

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

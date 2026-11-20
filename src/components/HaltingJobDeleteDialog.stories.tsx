import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { sequenceJob } from "@test/factories/sequence";
import { fn } from "storybook/test";

import HaltingJobDeleteDialog from "./HaltingJobDeleteDialog";

const meta: Meta<typeof HaltingJobDeleteDialog> = {
  args: {
    head: sequenceJob(7003n, JobState.Pending),
    jobId: 7001n,
    onClose: fn(),
    onDelete: fn(),
    onRetry: fn(),
    open: true,
    pendingCount: { count: 2341, more: false },
  },
  component: HaltingJobDeleteDialog,
  title: "Components/HaltingJobDeleteDialog",
};

export default meta;

type Story = StoryObj<typeof HaltingJobDeleteDialog>;

export const Default: Story = {};

export const OnePendingJob: Story = {
  args: { pendingCount: { count: 1, more: false } },
};

// Counts are capped, so a long backlog reads "1,000+".
export const CappedCount: Story = {
  args: { pendingCount: { count: 1000, more: true } },
};

// When an earlier job also halts the sequence, deleting this one doesn't
// release the waiting jobs yet.
export const EarlierHalt: Story = {
  args: {
    earlierHalt: sequenceJob(6998n, JobState.Discarded),
    jobId: 7001n,
  },
};

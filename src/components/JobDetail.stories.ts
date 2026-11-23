import type { Job } from "@services/jobs";
import type { JobSequence, JobSequenceStatus } from "@services/sequences";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import { jobFactory } from "@test/factories/job";
import {
  jobSequence,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
} from "@test/factories/sequence";

import JobDetail from "./JobDetail";

const meta: Meta<typeof JobDetail> = {
  component: JobDetail,
  title: "Pages/JobDetail",
};

export default meta;

type Story = StoryObj<typeof JobDetail>;

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

// Jobs in a sequence get a Sequence field and, while pending, a wait reason
// on the timeline. IDs follow one order's sequence: 7001 was cancelled and
// halts it, and 7003 is the next pending job.
const inSequence = (job: Job): Job => ({
  ...job,
  metadata: { ...job.metadata, seq_key: sequenceKeyFixture },
});

const sequenceStatus = (
  overrides: Partial<JobSequence> = {},
): JobSequenceStatus => ({
  error: false,
  jobSequence: jobSequence(overrides),
  key: sequenceKeyFixture,
});

const pendingInSequence = inSequence(jobFactory.pending().build({ id: 7003n }));
const halting = sequenceJob(7001n, JobState.Cancelled);
const head = sequenceJob(7003n, JobState.Pending);

export const SequenceHalted: Story = {
  args: {
    job: pendingInSequence,
    sequence: sequenceStatus({
      sequence: sequenceInspection({
        blockers: [halting],
        haltedBy: halting,
        head,
      }),
      waitingOn: halting,
      waitReason: "halted",
    }),
  },
};

export const SequenceWaitingOnRunningJob: Story = {
  args: {
    job: pendingInSequence,
    sequence: sequenceStatus({
      waitingOn: sequenceJob(7002n, JobState.Running),
      waitReason: "waiting_on_active",
    }),
  },
};

export const SequenceWaitingOnRetryableJob: Story = {
  args: {
    job: pendingInSequence,
    sequence: sequenceStatus({
      waitingOn: sequenceJob(7002n, JobState.Retryable),
      waitReason: "waiting_on_active",
    }),
  },
};

export const SequenceWaitingBehindPendingJob: Story = {
  args: {
    job: inSequence(jobFactory.pending().build({ id: 7010n })),
    sequence: sequenceStatus({
      jobId: 7010n,
      waitingOn: head,
      waitReason: "waiting_behind_pending",
    }),
  },
};

export const SequenceUpNext: Story = {
  args: {
    job: pendingInSequence,
    sequence: sequenceStatus({ waitReason: "up_next" }),
  },
};

const haltingJobStatus = sequenceStatus({
  halting: true,
  jobId: 7001n,
  jobState: JobState.Cancelled,
  sequence: sequenceInspection({
    blockers: [halting],
    haltedBy: halting,
    head,
    pendingCount: { count: 2341, more: false },
  }),
});

export const SequenceHaltingJob: Story = {
  args: {
    job: inSequence(jobFactory.cancelled().build({ id: 7001n })),
    sequence: haltingJobStatus,
  },
};

// Deleting a halting job warns that the jobs behind it run without it, and
// offers Retry instead.
export const SequenceHaltingJobDelete: Story = {
  args: SequenceHaltingJob.args,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
  },
};

export const SequenceNextPending: Story = {
  args: {
    job: inSequence(jobFactory.completed().build({ id: 6996n })),
    sequence: sequenceStatus({
      jobId: 6996n,
      jobState: JobState.Completed,
      sequence: sequenceInspection({ head }),
    }),
  },
};

export const SequenceNoPendingJobs: Story = {
  args: {
    job: inSequence(jobFactory.completed().build({ id: 7022n })),
    sequence: sequenceStatus({
      jobId: 7022n,
      jobState: JobState.Completed,
    }),
  },
};

export const SequenceLoading: Story = {
  args: {
    job: pendingInSequence,
    sequence: { error: false, key: sequenceKeyFixture },
  },
};

export const SequenceUnavailable: Story = {
  args: {
    job: pendingInSequence,
    sequence: { error: true, key: sequenceKeyFixture },
  },
};

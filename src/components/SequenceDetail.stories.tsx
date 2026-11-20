import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobState } from "@services/types";
import {
  haltedSequenceFixture,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
  sequenceListItem,
} from "@test/factories/sequence";
import { fn } from "storybook/test";

import SequenceDetail from "./SequenceDetail";

const meta: Meta<typeof SequenceDetail> = {
  args: {
    hasEarlier: false,
    hasLater: false,
    onJumpToJob: fn(),
    onRemoveHalt: fn(),
    onShowEarlier: fn(),
    onShowLater: fn(),
    sequenceKey: sequenceKeyFixture,
  },
  component: SequenceDetail,
  title: "Pages/SequenceDetail",
};

export default meta;

type Story = StoryObj<typeof SequenceDetail>;

// A cancelled job halts the sequence. The page opens at the halting job, with
// earlier completed jobs behind "Show earlier", and outlines the job the
// operator came from.
export const Halted: Story = {
  args: {
    hasEarlier: true,
    hasLater: true,
    inspection: haltedSequenceFixture.inspection,
    jobs: haltedSequenceFixture.jobs,
    selectedJobId: 7003n,
  },
};

// Deleting the halting job from the sequence page shows the same warning as
// the job page.
export const HaltedDelete: Story = {
  args: Halted.args,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
  },
};

const running = sequenceJob(7002n, JobState.Running);

export const WaitingOnRunningJob: Story = {
  args: {
    hasEarlier: true,
    inspection: sequenceInspection({
      blockers: [running],
      head: sequenceJob(7003n, JobState.Pending),
      pendingCount: { count: 2, more: false },
    }),
    jobs: [
      sequenceListItem(7002n, JobState.Running, 2, "packed"),
      sequenceListItem(7003n, JobState.Pending, 300, "shipped"),
      sequenceListItem(7010n, JobState.Pending, 120, "delivered"),
    ],
    selectedJobId: 7010n,
  },
};

export const UpNext: Story = {
  args: {
    hasEarlier: true,
    inspection: sequenceInspection({
      head: sequenceJob(7003n, JobState.Pending),
      pendingCount: { count: 1, more: false },
    }),
    jobs: [sequenceListItem(7003n, JobState.Pending, 1, "shipped")],
  },
};

// Nothing is pending or running, so the page shows the newest jobs.
export const Idle: Story = {
  args: {
    hasEarlier: true,
    inspection: sequenceInspection(),
    jobs: [
      sequenceListItem(6990n, JobState.Completed, 1440, "placed"),
      sequenceListItem(6996n, JobState.Completed, 900, "paid"),
      sequenceListItem(7001n, JobState.Completed, 420, "shipped"),
    ],
    selectedJobId: 6996n,
  },
};

// The job the operator came from is outside the loaded range.
export const SelectedJobNotLoaded: Story = {
  args: {
    ...Halted.args,
    selectedJobId: 6912n,
  },
};

export const Loading: Story = {
  args: {
    jobs: [],
    jobsLoading: true,
  },
};

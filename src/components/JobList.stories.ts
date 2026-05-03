import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobMinimal } from "@services/jobs";
import { StatesAndCounts } from "@services/states";
import { JobState } from "@services/types";
import { jobMinimalFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";

import JobList from "./JobList";

const meta: Meta<typeof JobList> = {
  component: JobList,
  title: "Pages/JobList",
};

export default meta;

type Story = StoryObj<typeof JobList>;

const buildRunningJobs = (count: number) =>
  Array.from({ length: count }, () => jobMinimalFactory.running().build());

const visualJobs: JobMinimal[] = [
  {
    args: { customerID: "cus_123", invoiceID: "inv_001" },
    attempt: 1,
    attemptedAt: new Date("2025-02-28T12:01:00.000Z"),
    attemptedBy: ["worker-1"],
    createdAt: new Date("2025-02-28T12:00:00.000Z"),
    finalizedAt: undefined,
    id: BigInt(101),
    kind: "ChargeCustomer",
    maxAttempts: 5,
    priority: 1,
    queue: "billing",
    scheduledAt: new Date("2025-02-28T12:00:30.000Z"),
    state: JobState.Running,
    tags: ["billing"],
  },
  {
    args: { customerID: "cus_456", invoiceID: "inv_002" },
    attempt: 2,
    attemptedAt: new Date("2025-02-28T11:56:00.000Z"),
    attemptedBy: ["worker-2"],
    createdAt: new Date("2025-02-28T11:55:00.000Z"),
    finalizedAt: undefined,
    id: BigInt(102),
    kind: "ChargeCustomer",
    maxAttempts: 5,
    priority: 2,
    queue: "billing",
    scheduledAt: new Date("2025-02-28T11:55:30.000Z"),
    state: JobState.Running,
    tags: ["billing", "retrying"],
  },
  {
    args: { customerID: "cus_789", invoiceID: "inv_003" },
    attempt: 1,
    attemptedAt: new Date("2025-02-28T11:52:00.000Z"),
    attemptedBy: ["worker-3"],
    createdAt: new Date("2025-02-28T11:50:00.000Z"),
    finalizedAt: undefined,
    id: BigInt(103),
    kind: "ChargeCustomer",
    maxAttempts: 3,
    priority: 1,
    queue: "default",
    scheduledAt: new Date("2025-02-28T11:50:30.000Z"),
    state: JobState.Running,
    tags: ["default"],
  },
];

const visualStatesAndCounts: StatesAndCounts = {
  available: BigInt(8),
  cancelled: BigInt(0),
  completed: BigInt(31),
  discarded: BigInt(1),
  pending: BigInt(4),
  retryable: BigInt(2),
  running: BigInt(3),
  scheduled: BigInt(6),
};
// Default running jobs story
export const Running: Story = {
  args: {
    jobs: buildRunningJobs(10),
    setJobRefetchesPaused: () => {},
    state: JobState.Running,
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: false,
    }),
    settings: {},
  },
};

// Shows jobs with args hidden by server default
export const ArgsHiddenByDefault: Story = {
  args: {
    ...Running.args,
    jobs: buildRunningJobs(10),
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: true,
    }),
    settings: {},
  },
};

// Shows jobs with args visible because of user override
export const ArgsVisibleUserOverride: Story = {
  args: {
    ...Running.args,
    jobs: buildRunningJobs(10),
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: true,
    }),
    settings: { showJobArgs: true },
  },
};

// Shows jobs with args hidden because of user override
export const ArgsHiddenUserOverride: Story = {
  args: {
    ...Running.args,
    jobs: buildRunningJobs(10),
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: false,
    }),
    settings: { showJobArgs: false },
  },
};

export const VisualRegression: Story = {
  args: {
    cancelJobs: () => {},
    canShowFewer: true,
    canShowMore: true,
    deleteJobs: () => {},
    jobs: visualJobs,
    retryJobs: () => {},
    setJobRefetchesPaused: () => {},
    showFewer: () => {},
    showMore: () => {},
    state: JobState.Running,
    statesAndCounts: visualStatesAndCounts,
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: false,
    }),
    router: {
      initialEntries: ["/jobs?state=running"],
      routes: ["/jobs", "/jobs/$jobId"],
    },
    settings: {},
  },
  tags: ["visual"],
};

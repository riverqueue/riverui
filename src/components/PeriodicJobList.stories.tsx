import type { Meta, StoryObj } from "@storybook/react-vite";

import { PeriodicJob } from "@services/periodicJobs";

import PeriodicJobList from "./PeriodicJobList";

const meta: Meta<typeof PeriodicJobList> = {
  component: PeriodicJobList,
  parameters: {
    layout: "fullscreen",
  },
  title: "Pages/PeriodicJobList",
};

export default meta;
type Story = StoryObj<typeof PeriodicJobList>;

const baseTime = new Date("2025-01-15T12:00:00.000Z");
const oneDayInMs = 24 * 60 * 60 * 1000;

// Helper function to create mock periodic jobs
const createMockJob = (
  id: string,
  daysAgo: number,
  nextRunDays: number,
): PeriodicJob => {
  const createdAt = new Date(baseTime.getTime() - daysAgo * oneDayInMs);
  const nextRunAt = new Date(baseTime.getTime() + nextRunDays * oneDayInMs);
  const updatedAt = new Date(
    baseTime.getTime() - Math.floor(daysAgo / 2) * oneDayInMs,
  );

  return {
    createdAt,
    id,
    nextRunAt,
    updatedAt,
  };
};

const manyJobDaysAgo = [
  5, 11, 23, 2, 18, 7, 26, 13, 9, 30, 16, 4, 21, 14, 1, 28, 8, 19, 6, 24,
];
const manyJobNextRunDays = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 3, 5, 7, 9, 11,
];

export const Loading: Story = {
  args: {
    jobs: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    jobs: [],
    loading: false,
  },
};

export const SingleJob: Story = {
  args: {
    jobs: [createMockJob("periodic-job-1", 7, 1)],
    loading: false,
  },
};

export const MultipleJobs: Story = {
  args: {
    jobs: [
      createMockJob("periodic-job-1", 30, 1),
      createMockJob("periodic-job-2", 15, 3),
      createMockJob("periodic-job-3", 7, 7),
      createMockJob("periodic-job-4", 3, 14),
      createMockJob("periodic-job-5", 1, 30),
    ],
    loading: false,
  },
};

export const JobsWithVariousTimings: Story = {
  args: {
    jobs: [
      createMockJob("hourly-job", 0.5, 0.04), // 1 hour ago, next run in ~1 hour
      createMockJob("daily-job", 1, 1), // 1 day ago, next run in 1 day
      createMockJob("weekly-job", 7, 7), // 1 week ago, next run in 1 week
      createMockJob("monthly-job", 30, 30), // 1 month ago, next run in 1 month
      createMockJob("overdue-job", 5, -1), // 5 days ago, overdue by 1 day
    ],
    loading: false,
  },
};

export const LongJobIds: Story = {
  args: {
    jobs: [
      createMockJob(
        "very-long-periodic-job-id-that-might-cause-layout-issues",
        7,
        1,
      ),
      createMockJob(
        "another-extremely-long-periodic-job-identifier-for-testing-purposes",
        14,
        3,
      ),
      createMockJob("short-id", 21, 7),
    ],
    loading: false,
  },
};

export const ManyJobs: Story = {
  args: {
    jobs: manyJobDaysAgo.map((daysAgo, i) =>
      createMockJob(`periodic-job-${i + 1}`, daysAgo, manyJobNextRunDays[i]),
    ),
    loading: false,
  },
};

export const RecentJobs: Story = {
  args: {
    jobs: [
      createMockJob("recent-job-1", 0.1, 0.1), // Very recent
      createMockJob("recent-job-2", 0.5, 0.5), // 12 hours ago
      createMockJob("recent-job-3", 1, 1), // 1 day ago
    ],
    loading: false,
  },
};

export const FutureJobs: Story = {
  args: {
    jobs: [
      createMockJob("future-job-1", 1, 30), // Next run in 30 days
      createMockJob("future-job-2", 7, 60), // Next run in 60 days
      createMockJob("future-job-3", 14, 90), // Next run in 90 days
    ],
    loading: false,
  },
};

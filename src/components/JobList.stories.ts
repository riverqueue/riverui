import type { Meta, StoryObj } from "@storybook/react-vite";

import { useFeatures } from "@contexts/Features.hook";
import { useSettings } from "@hooks/use-settings";
import { JobState } from "@services/types";
import { jobMinimalFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";
import { vi } from "vitest";

import JobList from "./JobList";

// Mock hooks for stories
vi.mock("@contexts/Features.hook", () => ({
  useFeatures: vi.fn(),
}));

vi.mock("@hooks/use-settings", () => ({
  useSettings: vi.fn(),
}));

const meta: Meta<typeof JobList> = {
  component: JobList,
  title: "Pages/JobList",
};

export default meta;

type Story = StoryObj<typeof JobList>;

// Default running jobs story
export const Running: Story = {
  args: {
    jobs: jobMinimalFactory.running().buildList(10),
    setJobRefetchesPaused: () => {},
    state: JobState.Running,
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            jobListHideArgsByDefault: false,
          }),
        },
      },
      {
        hook: useSettings,
        mockValue: {
          settings: {},
        },
      },
    ],
  },
};

// Shows jobs with args hidden by server default
export const ArgsHiddenByDefault: Story = {
  args: {
    ...Running.args,
    jobs: jobMinimalFactory.running().buildList(10),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            jobListHideArgsByDefault: true,
          }),
        },
      },
      {
        hook: useSettings,
        mockValue: {
          settings: {},
        },
      },
    ],
  },
};

// Shows jobs with args visible because of user override
export const ArgsVisibleUserOverride: Story = {
  args: {
    ...Running.args,
    jobs: jobMinimalFactory.running().buildList(10),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            jobListHideArgsByDefault: true,
          }),
        },
      },
      {
        hook: useSettings,
        mockValue: {
          settings: { showJobArgs: true },
        },
      },
    ],
  },
};

// Shows jobs with args hidden because of user override
export const ArgsHiddenUserOverride: Story = {
  args: {
    ...Running.args,
    jobs: jobMinimalFactory.running().buildList(10),
  },
  parameters: {
    mockData: [
      {
        hook: useFeatures,
        mockValue: {
          features: createFeatures({
            jobListHideArgsByDefault: false,
          }),
        },
      },
      {
        hook: useSettings,
        mockValue: {
          settings: { showJobArgs: false },
        },
      },
    ],
  },
};

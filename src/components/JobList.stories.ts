import type { Meta, StoryObj } from "@storybook/react-vite";

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

// Default running jobs story
export const Running: Story = {
  args: {
    jobs: jobMinimalFactory.running().buildList(10),
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
    jobs: jobMinimalFactory.running().buildList(10),
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
    jobs: jobMinimalFactory.running().buildList(10),
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
    jobs: jobMinimalFactory.running().buildList(10),
  },
  parameters: {
    features: createFeatures({
      jobListHideArgsByDefault: false,
    }),
    settings: { showJobArgs: false },
  },
};

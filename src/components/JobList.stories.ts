import type { Meta, StoryObj } from "@storybook/react";

import { JobState } from "@services/types";
import { jobFactory } from "@test/factories/job";

import JobList from "./JobList";

const meta: Meta<typeof JobList> = {
  component: JobList,
  title: "Pages/JobList",
};

export default meta;

type Story = StoryObj<typeof JobList>;

export const Running: Story = {
  args: {
    jobs: jobFactory.running().buildList(10),
    state: JobState.Running,
  },
};

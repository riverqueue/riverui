import type { Meta, StoryObj } from "@storybook/react";

import JobList from "./JobList";
import { jobFactory } from "@test/factories/job";

const meta: Meta<typeof JobList> = {
  title: "Pages/JobList",
  component: JobList,
};

export default meta;

type Story = StoryObj<typeof JobList>;

export const Running: Story = {
  args: {
    jobs: jobFactory.running().buildList(10),
  },
};

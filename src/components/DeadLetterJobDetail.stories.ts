import type { Meta, StoryObj } from "@storybook/react-vite";

import { jobFactory } from "@test/factories/job";

import DeadLetterJobDetail from "./DeadLetterJobDetail";

const meta: Meta<typeof DeadLetterJobDetail> = {
  component: DeadLetterJobDetail,
  title: "Pages/DeadLetterJobDetail",
};

export default meta;

type Story = StoryObj<typeof DeadLetterJobDetail>;

export const Default: Story = {
  args: {
    job: jobFactory.discarded().build(),
    retry: () => {},
    retryPending: false,
  },
};

export const Retrying: Story = {
  args: {
    ...Default.args,
    retryPending: true,
  },
};

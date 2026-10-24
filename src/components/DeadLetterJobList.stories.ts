import type { Meta, StoryObj } from "@storybook/react-vite";

import { FilterTypeId } from "@components/job-search/JobSearch";
import { jobMinimalFactory } from "@test/factories/job";

import DeadLetterJobList from "./DeadLetterJobList";

const meta: Meta<typeof DeadLetterJobList> = {
  component: DeadLetterJobList,
  title: "Pages/DeadLetterJobList",
};

export default meta;

type Story = StoryObj<typeof DeadLetterJobList>;

export const Default: Story = {
  args: {
    canShowFewer: false,
    canShowMore: true,
    initialFilters: [],
    jobs: jobMinimalFactory.discarded().buildList(10),
    loading: false,
    onFiltersChange: () => {},
    showFewer: () => {},
    showMore: () => {},
  },
};

export const Empty: Story = {
  args: {
    ...Default.args,
    canShowMore: false,
    jobs: [],
  },
};

export const NoFilterMatches: Story = {
  args: {
    ...Empty.args,
    initialFilters: [
      {
        id: FilterTypeId.KIND,
        match: "kind:",
        typeId: FilterTypeId.KIND,
        values: ["missing"],
      },
    ],
  },
};

export const RefreshFailed: Story = {
  args: {
    ...Default.args,
    loadError: "Couldn't refresh dead letter jobs: Failed to fetch",
  },
};

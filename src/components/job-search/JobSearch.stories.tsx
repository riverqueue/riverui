import type { Meta, StoryObj } from "@storybook/react";

import { JobSearch } from "./JobSearch";

const meta: Meta<typeof JobSearch> = {
  component: JobSearch,
  parameters: {
    layout: "fullscreen",
  },
  title: "Components/JobSearch",
};

export default meta;
type Story = StoryObj<typeof JobSearch>;

export const Default: Story = {
  render: () => (
    <div className="w-full p-4">
      <JobSearch />
    </div>
  ),
};

export const WithInitialFilters: Story = {
  render: () => (
    <div className="w-full p-4">
      <JobSearch
        initialFilters={[
          {
            id: "1",
            prefix: "kind:",
            typeId: "kind",
            values: ["batch", "stream"],
          },
          {
            id: "2",
            prefix: "queue:",
            typeId: "queue",
            values: ["default"],
          },
          {
            id: "3",
            prefix: "priority:",
            typeId: "priority",
            values: ["1", "2"],
          },
        ]}
      />
    </div>
  ),
};

export const WithFilterChangeHandler: Story = {
  render: () => (
    <div className="w-full p-4">
      <JobSearch
        onFiltersChange={(filters) => {
          console.log("Filters changed:", filters);
        }}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";

import { FacetedSearchExample } from "./FacetedSearchExample";

const meta: Meta<typeof FacetedSearchExample> = {
  component: FacetedSearchExample,
  parameters: {
    layout: "centered",
  },
  title: "Examples/FacetedSearch",
};

export default meta;
type Story = StoryObj<typeof FacetedSearchExample>;

export const Default: Story = {
  render: () => <FacetedSearchExample />,
};

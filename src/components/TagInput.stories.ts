import type { Meta, StoryObj } from "@storybook/react";

import { type BadgeColor } from "./Badge";
import TagInput from "./TagInput";

const meta: Meta<typeof TagInput> = {
  argTypes: {
    badgeColor: {
      control: "select",
    },
    onChange: { action: "changed" },
    showHelpText: {
      control: "boolean",
      description: "Show the helper text below the input",
    },
  },
  component: TagInput,
  tags: ["autodocs"],
  title: "Components/TagInput",
};

export default meta;

type Story = StoryObj<typeof TagInput>;

export const Empty: Story = {
  args: {
    disabled: false,
    placeholder: "Type and press Enter to add",
    showHelpText: false,
    tags: [],
  },
};

export const EmptyWithHelp: Story = {
  args: {
    disabled: false,
    placeholder: "Type and press Enter to add",
    showHelpText: true,
    tags: [],
  },
};

export const WithTags: Story = {
  args: {
    badgeColor: "indigo",
    disabled: false,
    showHelpText: false,
    tags: ["customer_id", "region", "user_id"],
  },
};

export const WithTagsAndHelp: Story = {
  args: {
    badgeColor: "indigo",
    disabled: false,
    showHelpText: true,
    tags: ["customer_id", "region", "user_id"],
  },
};

export const WithManyTags: Story = {
  args: {
    disabled: false,
    tags: [
      "customer_id",
      "region",
      "user_id",
      "order_id",
      "product_id",
      "session_id",
      "long_key_name_with_many_characters",
    ],
  },
};

export const BlueBadges: Story = {
  args: {
    badgeColor: "blue" as BadgeColor,
    disabled: false,
    tags: ["customer_id", "region", "user_id"],
  },
};

export const GreenBadges: Story = {
  args: {
    badgeColor: "green" as BadgeColor,
    disabled: false,
    tags: ["customer_id", "region", "user_id"],
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    tags: ["customer_id", "region"],
  },
};

export const DisabledEmpty: Story = {
  args: {
    disabled: true,
    tags: [],
  },
};

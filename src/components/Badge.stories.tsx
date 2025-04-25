import type { Meta, StoryObj } from "@storybook/react";

import { Badge, BadgeButton } from "./Badge";

const meta: Meta<typeof Badge> = {
  component: Badge,
  parameters: {
    layout: "centered",
  },
  title: "Components/Badge",
};

export default meta;
type Story = StoryObj<typeof Badge>;

const colors = [
  "amber",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "green",
  "indigo",
  "light",
  "lime",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "teal",
  "violet",
  "yellow",
  "zinc",
] as const;

export const AllColors: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Regular Badges
        </h3>
        <div className="flex flex-wrap gap-4">
          {colors.map((color) => (
            <Badge color={color} key={color}>
              {color}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Badge Links (with href)
        </h3>
        <div className="flex flex-wrap gap-4">
          {colors.map((color) => (
            <BadgeButton color={color} href="#" key={color}>
              {color}
            </BadgeButton>
          ))}
        </div>
      </div>
    </div>
  ),
};

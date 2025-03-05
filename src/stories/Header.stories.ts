import type { Meta, StoryObj } from "@storybook/react";

import { Header } from "./Header";

const meta = {
  component: Header,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  title: "Example/Header",
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    onCreateAccount: () => {},
    onLogin: () => {},
    onLogout: () => {},
    user: {
      name: "Jane Doe",
    },
  },
};

export const LoggedOut: Story = {
  args: {
    onCreateAccount: () => {},
    onLogin: () => {},
    onLogout: () => {},
    user: undefined,
  },
};

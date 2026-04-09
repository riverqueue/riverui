import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-onboarding",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "@storybook/addon-docs",
  ],

  core: {
    disableTelemetry: true,
  },

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
};
export default config;

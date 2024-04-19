import React from "react";
import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import { ReactRenderer } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../src/global-type-overrides";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  decorators: [
    withThemeByClassName<ReactRenderer>({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;

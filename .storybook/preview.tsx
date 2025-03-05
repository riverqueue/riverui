import type { Preview } from "@storybook/react";
import type { PartialStoryFn, StoryContext } from "@storybook/types";

import { withThemeByClassName } from "@storybook/addon-themes";
import { ReactRenderer } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import React from "react";

import "../src/global-type-overrides";
import "../src/index.css";

function withRouter(Story: PartialStoryFn, { parameters }: StoryContext) {
  const {
    initialEntries = ["/"],
    initialIndex,
    routes = ["/"],
  } = parameters?.router || {};

  const rootRoute = createRootRoute();

  const children = routes.map((path) =>
    createRoute({
      component: Story,
      getParentRoute: () => rootRoute,
      path,
    }),
  );

  rootRoute.addChildren(children);

  const router = createRouter({
    history: createMemoryHistory({ initialEntries, initialIndex }),
    routeTree: rootRoute,
  });

  return <RouterProvider router={router} />;
}

declare module "@storybook/types" {
  interface Parameters {
    router?: {
      initialEntries?: string[];
      initialIndex?: number;
      routes?: string[];
    };
  }
}

const preview: Preview = {
  decorators: [
    withRouter,
    withThemeByClassName<ReactRenderer>({
      defaultTheme: "light",
      themes: {
        dark: "dark",
        light: "light",
      },
    }),
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

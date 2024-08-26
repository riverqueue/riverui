import React from "react";
import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import { ReactRenderer } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { PartialStoryFn, StoryContext } from "@storybook/types";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

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
      path,
      getParentRoute: () => rootRoute,
      component: Story,
    })
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
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  decorators: [
    withRouter,
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

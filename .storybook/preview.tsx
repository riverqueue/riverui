import type { Decorator, Preview } from "@storybook/react-vite";

import { withThemeByClassName } from "@storybook/addon-themes";
import { ReactRenderer } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import React from "react";

import type { Features } from "../src/services/features";

import "../src/global-type-overrides";
import "../src/index.css";
import { FeaturesContext } from "../src/contexts/Features";

/**
 * Decorator that provides feature flags to stories
 * Can be overridden per story using parameters.features
 */
export const withFeatures: Decorator = (StoryFn, context) => {
  // Default features with story-specific overrides
  const features = {
    hasProducerTable: true,
    producerQueries: true,
    ...context.parameters?.features,
  };

  return (
    <FeaturesContext.Provider value={{ features }}>
      <StoryFn />
    </FeaturesContext.Provider>
  );
};

/**
 * Decorator that provides router context for stories
 * Can be configured per story using parameters.router
 */
export const withRouter: Decorator = (StoryFn, context) => {
  const {
    initialEntries = ["/"],
    initialIndex,
    routes = ["/"],
  } = context.parameters?.router || {};

  // Create a router instance only when needed
  const rootRoute = createRootRoute();
  const routeComponents = routes.map((path) =>
    createRoute({
      component: () => <StoryFn />,
      getParentRoute: () => rootRoute,
      path,
    }),
  );

  rootRoute.addChildren(routeComponents);

  const router = createRouter({
    history: createMemoryHistory({ initialEntries, initialIndex }),
    routeTree: rootRoute,
  });

  return <RouterProvider router={router} />;
};

/**
 * Decorator for theme provider
 */
export const withThemeProvider: Decorator = (StoryFn) => (
  <ThemeProvider>
    <StoryFn />
  </ThemeProvider>
);

// Define parameter types
declare module "@storybook/react-vite" {
  interface Parameters {
    features?: Partial<Features>;
    router?: {
      initialEntries?: string[];
      initialIndex?: number;
      routes?: string[];
    };
  }
}

const preview: Preview = {
  decorators: [
    withFeatures,
    withRouter,
    withThemeByClassName<ReactRenderer>({
      defaultTheme: "light",
      themes: {
        dark: "dark",
        light: "light",
      },
    }),
    withThemeProvider,
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

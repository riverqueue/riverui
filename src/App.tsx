import { Providers } from "@providers";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ReactElement } from "react";

import "./global-type-overrides";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

// Create a new router instance
const router = createRouter({
  basepath:
    window && window.__riverUiBasePath ? window.__riverUiBasePath() : "/",
  context: { queryClient },
  routeTree,
  trailingSlash: "preserve",
});

// Register your router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const App = (): ReactElement => {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
};

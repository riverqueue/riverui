import { Providers } from "@providers";
import { type Features, featuresKey, getFeatures } from "@services/features";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "./global-type-overrides";

import { ReactElement, useEffect, useState } from "react";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

// Create a new router instance
const router = createRouter({
  basepath:
    window && window.__riverUiBasePath ? window.__riverUiBasePath() : "/",
  context: {
    features: {
      hasClientTable: false,
      hasProducerTable: false,
      hasWorkflows: false,
    } as Features,
    queryClient,
  },
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Fetch features before rendering the app
    queryClient
      .fetchQuery({
        queryFn: getFeatures,
        queryKey: featuresKey(),
      })
      .then((features) => {
        router.update({
          context: {
            features,
            queryClient,
          },
        });
        setIsReady(true);
      });
  }, []);

  if (!isReady) {
    return <div></div>;
  }

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
};

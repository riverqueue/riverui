import { createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { Root } from "@components/Root";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
  },
);

function RootComponent() {
  return <Root />;
}

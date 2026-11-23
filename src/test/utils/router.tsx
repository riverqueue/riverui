import type { ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";

// renderWithRouter renders a component that uses router links. Links build
// their href from `to` and params, so the tree doesn't need their routes.
export const renderWithRouter = async (ui: () => ReactNode) => {
  const rootRoute = createRootRoute({ component: ui });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute,
  });
  await act(() => router.load());
  return render(<RouterProvider router={router} />);
};

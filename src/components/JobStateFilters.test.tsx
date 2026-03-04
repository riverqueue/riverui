import { JobState } from "@services/types";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  stripSearchParams,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { defaultValues, jobSearchSchema } from "../routes/jobs/index.schema";
import { JobStateFilters } from "./JobStateFilters";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const jobsRoute = createRoute({
  component: () => <JobStateFilters />,
  getParentRoute: () => rootRoute,
  path: "/jobs",
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
  validateSearch: jobSearchSchema,
});

const routeTree = rootRoute.addChildren([jobsRoute]);

const renderWithLocation = async (location: string) => {
  const history = createMemoryHistory({
    initialEntries: [location],
  });

  const router = createRouter({
    history,
    routeTree,
  });

  await router.load();

  return render(<RouterProvider router={router} />);
};

describe("JobStateFilters", () => {
  test("only the selected state link is active", async () => {
    await renderWithLocation(`/jobs?state=${JobState.Discarded}`);

    const discardedLink = await screen.findByRole("link", {
      name: "Discarded",
    });
    const runningLink = screen.getByRole("link", { name: "Running" });

    expect(discardedLink).toHaveAttribute("data-status", "active");
    expect(runningLink).not.toHaveAttribute("data-status", "active");
  });

  test("running is active when no state is explicitly selected", async () => {
    await renderWithLocation("/jobs");

    const runningLink = await screen.findByRole("link", { name: "Running" });
    expect(runningLink).toHaveAttribute("data-status", "active");
  });
});

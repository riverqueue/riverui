import { StatesAndCounts } from "@services/states";
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

const renderWithLocation = async (
  location: string,
  statesAndCounts?: StatesAndCounts,
) => {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const jobsRoute = createRoute({
    component: () => <JobStateFilters statesAndCounts={statesAndCounts} />,
    getParentRoute: () => rootRoute,
    path: "/jobs",
    search: {
      middlewares: [stripSearchParams(defaultValues)],
    },
    validateSearch: jobSearchSchema,
  });
  const history = createMemoryHistory({
    initialEntries: [location],
  });

  const router = createRouter({
    history,
    routeTree: rootRoute.addChildren([jobsRoute]),
  });

  await router.load();

  return render(<RouterProvider router={router} />);
};

const statesAndCounts = (
  overrides: Partial<StatesAndCounts>,
): StatesAndCounts => ({
  available: { accuracy: "exact", count: 0n },
  cancelled: { accuracy: "exact", count: 0n },
  completed: { accuracy: "exact", count: 0n },
  discarded: { accuracy: "exact", count: 0n },
  pending: { accuracy: "exact", count: 0n },
  retryable: { accuracy: "exact", count: 0n },
  running: { accuracy: "exact", count: 0n },
  scheduled: { accuracy: "exact", count: 0n },
  ...overrides,
});

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

  test("shows exact, cached, estimated, and lower-bound telemetry", async () => {
    const observedAt = new Date("2026-08-10T12:00:00Z");
    await renderWithLocation(
      "/jobs",
      statesAndCounts({
        available: {
          accuracy: "lower_bound",
          count: 10_000n,
          observedAt,
        },
        completed: {
          accuracy: "exact_cached",
          count: 12_345_678n,
          observedAt,
        },
        discarded: {
          accuracy: "estimated",
          count: 987_654n,
          observedAt,
        },
        running: { accuracy: "exact", count: 2n, observedAt },
      }),
    );

    expect(await screen.findByText("10K+")).toHaveAttribute(
      "title",
      expect.stringContaining("useful database estimate"),
    );
    expect(screen.getByText("12.3M")).toHaveAttribute(
      "title",
      expect.stringContaining("12,345,678 jobs (exact snapshot"),
    );
    expect(screen.getByText("≈987.7K")).toHaveAttribute(
      "title",
      expect.stringContaining(
        "Approximately 987,654 jobs (database statistics",
      ),
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

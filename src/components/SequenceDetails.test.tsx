import type { JobSequence, SequenceJob } from "@services/sequences";

import { JobState } from "@services/types";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import SequenceDetails from "./SequenceDetails";

const pending: SequenceJob = {
  id: 1970670598291982291n,
  kind: "update_invoice",
  queue: "invoices",
  scheduledAt: new Date("2026-11-13T12:00:00Z"),
  state: JobState.Pending,
};

const sequence: JobSequence = {
  blockers: [
    {
      ...pending,
      id: pending.id - 1n,
      kind: "process_invoice",
      state: JobState.Cancelled,
    },
  ],
  firstPending: pending,
  jobId: pending.id,
  key: "invoice-sequence-key",
  waitReason: "halted",
};

async function renderSequence(value: JobSequence) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    component: () => (
      <SequenceDetails sequence={value} sequenceKey={value.key} />
    ),
    getParentRoute: () => root,
    path: "/",
  });
  const job = createRoute({ getParentRoute: () => root, path: "/jobs/$jobId" });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: root.addChildren([index, job]),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
}

test("identifies a halted sequence and links to its blocker and pending head", async () => {
  await renderSequence(sequence);
  expect(
    screen.getByText("Sequence halted by a failed job"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "#1970670598291982290" }),
  ).toHaveAttribute("href", "/jobs/1970670598291982290");
  expect(
    screen.getByRole("link", { name: "#1970670598291982291" }),
  ).toHaveAttribute("href", "/jobs/1970670598291982291");
  expect(screen.getByText("cancelled")).toBeInTheDocument();
  expect(screen.getByText("process_invoice · invoices")).toBeInTheDocument();
  expect(screen.getByText("(this job)")).toBeInTheDocument();
});

test("distinguishes normal waiting from a halted sequence", async () => {
  await renderSequence({
    ...sequence,
    blockers: [{ ...sequence.blockers[0]!, state: JobState.Running }],
    waitReason: "waiting",
  });
  expect(
    screen.getByText("Waiting for jobs in this sequence"),
  ).toBeInTheDocument();
  expect(screen.getByText("running")).toBeInTheDocument();
  expect(
    screen.queryByText("Sequence halted by a failed job"),
  ).not.toBeInTheDocument();
});

test("shows the pending head when it is awaiting scheduling", async () => {
  await renderSequence({
    ...sequence,
    blockers: [],
    waitReason: "awaiting_promotion",
  });
  expect(
    screen.getByText("Waiting for sequence scheduling"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByText("Next pending job")).not.toBeInTheDocument();
});

test("does not present stale blockers when refreshing fails", () => {
  render(
    <SequenceDetails error sequence={sequence} sequenceKey={sequence.key} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Sequence details could not be loaded.",
  );
  expect(
    screen.queryByText("Sequence halted by a failed job"),
  ).not.toBeInTheDocument();
});

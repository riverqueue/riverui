import { jobFactory } from "@test/factories/job";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import JobTimeline from "./JobTimeline";

const NOW = new Date("2026-04-11T12:00:00.000Z");

vi.mock("react-time-sync", () => ({
  useTime: () => NOW.getTime() / 1000,
}));

const getStepItem = (name: string): HTMLLIElement => {
  const stepItem = screen.getByText(name).closest("li");
  if (!(stepItem instanceof HTMLLIElement)) {
    throw new Error(`Expected ${name} step list item`);
  }

  return stepItem;
};

const getStepIcon = (name: string): HTMLSpanElement => {
  const stepIcon = getStepItem(name).querySelector("span.absolute");
  if (!(stepIcon instanceof HTMLSpanElement)) {
    throw new Error(`Expected ${name} step icon`);
  }

  return stepIcon;
};

const getStepNames = (): string[] => {
  return screen
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent ?? "");
};

describe("JobTimeline", () => {
  it("renders snoozed jobs with a dedicated snoozed step after running", () => {
    // This fixture models a job that already ran once, then was snoozed back
    // into `scheduled`. In that state, the next retry time is known, but the
    // original schedule/wait timing before the prior run is not.
    const snoozedJob = jobFactory.scheduledSnoozed().build({
      attemptedAt: new Date("2026-04-11T12:00:03.000Z"),
      createdAt: NOW,
      errors: [],
      finalizedAt: undefined,
      scheduledAt: new Date("2026-04-11T12:30:00.000Z"),
    });

    render(<JobTimeline job={snoozedJob} />);

    expect(getStepNames()).toEqual([
      "Created",
      "Scheduled",
      "Wait",
      "Running",
      "Snoozed",
      "Complete",
    ]);
    expect(within(getStepItem("Scheduled")).getByText("—")).toBeInTheDocument();
    expect(within(getStepItem("Wait")).getByText("—")).toBeInTheDocument();
    expect(
      within(getStepItem("Running")).queryByText("Not yet started"),
    ).toBeNull();
    expect(
      within(getStepItem("Snoozed")).getByText(/Retrying/),
    ).toBeInTheDocument();
    expect(
      within(getStepItem("Snoozed")).queryByText(/Job snoozed/i),
    ).toBeNull();
    expect(getStepIcon("Scheduled")).toHaveClass("bg-green-300");
    expect(getStepIcon("Snoozed")).toHaveClass("bg-amber-200");
    expect(screen.queryByText("-1h-30m-57s")).not.toBeInTheDocument();
  });

  it("keeps the regular scheduled timeline for jobs that have not run yet", () => {
    const scheduledJob = jobFactory.scheduled().build({
      createdAt: NOW,
      scheduledAt: new Date("2026-04-11T12:30:00.000Z"),
    });

    render(<JobTimeline job={scheduledJob} />);

    expect(getStepNames()).toEqual([
      "Created",
      "Scheduled",
      "Wait",
      "Running",
      "Complete",
    ]);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.queryByText("Snoozed")).not.toBeInTheDocument();
    expect(getStepIcon("Scheduled")).toHaveClass("bg-amber-200");
  });

  it("keeps retryable jobs on the retry path instead of the snoozed path", () => {
    const retryableJob = jobFactory.retryable().build({
      scheduledAt: new Date("2026-04-11T12:30:00.000Z"),
    });

    render(<JobTimeline job={retryableJob} />);

    expect(screen.getByText("Awaiting Retry")).toBeInTheDocument();
    expect(screen.queryByText("Snoozed")).not.toBeInTheDocument();
  });
});

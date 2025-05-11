import { FeaturesContext } from "@contexts/Features";
import { JobState } from "@services/types";
import { jobMinimalFactory } from "@test/factories/job";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import JobList from "./JobList";

vi.mock("@tanstack/react-router", () => {
  return {
    Link: ({
      children,
      className,
      to,
    }: {
      children: React.ReactNode;
      className: string;
      to: string;
    }) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
  };
});

describe("JobList", () => {
  it("shows job args by default", () => {
    const job = jobMinimalFactory.build();
    const features = {
      hasClientTable: false,
      hasProducerTable: false,
      hasWorkflows: false,
      jobListHideArgsByDefault: false,
    };

    render(
      <FeaturesContext.Provider value={{ features }}>
        <JobList
          cancelJobs={vi.fn()}
          canShowFewer={false}
          canShowMore={false}
          deleteJobs={vi.fn()}
          jobs={[job]}
          retryJobs={vi.fn()}
          setJobRefetchesPaused={vi.fn()}
          showFewer={vi.fn()}
          showMore={vi.fn()}
          state={JobState.Running}
          statesAndCounts={undefined}
        />
      </FeaturesContext.Provider>,
    );

    expect(screen.getByText(JSON.stringify(job.args))).toBeInTheDocument();
  });

  it("hides job args when jobListHideArgsByDefault is true", () => {
    const job = jobMinimalFactory.build();
    const features = {
      hasClientTable: false,
      hasProducerTable: false,
      hasWorkflows: false,
      jobListHideArgsByDefault: true,
    };

    render(
      <FeaturesContext.Provider value={{ features }}>
        <JobList
          cancelJobs={vi.fn()}
          canShowFewer={false}
          canShowMore={false}
          deleteJobs={vi.fn()}
          jobs={[job]}
          retryJobs={vi.fn()}
          setJobRefetchesPaused={vi.fn()}
          showFewer={vi.fn()}
          showMore={vi.fn()}
          state={JobState.Running}
          statesAndCounts={undefined}
        />
      </FeaturesContext.Provider>,
    );

    expect(
      screen.queryByText(JSON.stringify(job.args)),
    ).not.toBeInTheDocument();
  });
});

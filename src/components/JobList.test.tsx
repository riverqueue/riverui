import { FeaturesContext } from "@contexts/Features";
import { useSettings } from "@hooks/use-settings";
import { JobState } from "@services/types";
import { jobMinimalFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";
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

// Mock the useSettings hook
vi.mock("@hooks/use-settings", () => ({
  useSettings: vi.fn(),
}));

describe("JobList", () => {
  it("shows job args by default", () => {
    const job = jobMinimalFactory.build();
    const features = createFeatures({
      jobListHideArgsByDefault: false,
    });

    // Mock settings with no override
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: {},
    });

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
    const features = createFeatures({
      jobListHideArgsByDefault: true,
    });

    // Mock settings with no override
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: {},
    });

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

  it("shows job args when user overrides default hide setting", () => {
    const job = jobMinimalFactory.build();
    const features = createFeatures({
      jobListHideArgsByDefault: true, // Server default is to hide
    });

    // Mock settings with override to show args
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: { showJobArgs: true },
    });

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

    // Even though server default is to hide, user setting should make them visible
    expect(screen.getByText(JSON.stringify(job.args))).toBeInTheDocument();
  });

  it("hides job args when user overrides default show setting", () => {
    const job = jobMinimalFactory.build();
    const features = createFeatures({
      jobListHideArgsByDefault: false, // Server default is to show
    });

    // Mock settings with override to hide args
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: { showJobArgs: false },
    });

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

    // Even though server default is to show, user setting should hide them
    expect(
      screen.queryByText(JSON.stringify(job.args)),
    ).not.toBeInTheDocument();
  });
});

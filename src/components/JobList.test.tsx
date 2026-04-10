import { FeaturesContext } from "@contexts/Features";
import { JobState } from "@services/types";
import { jobMinimalFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode } from "react";
import { userEvent } from "storybook/test";
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";

import JobList from "./JobList";

type UseSettings = typeof import("@hooks/use-settings").useSettings;
type UseSettingsReturn = ReturnType<UseSettings>;

const { mockUseSettings } = vi.hoisted(() => ({
  mockUseSettings: vi.fn() as MockedFunction<UseSettings>,
}));

const settingsMock = (
  settings: UseSettingsReturn["settings"],
): UseSettingsReturn => ({
  clearShowJobArgs: vi.fn(),
  setShowJobArgs: vi.fn(),
  settings,
  shouldShowJobArgs: true,
});

vi.mock("@tanstack/react-router", () => {
  return {
    Link: ({
      children,
      className,
      to,
    }: {
      children: ReactNode;
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
  useSettings: mockUseSettings,
}));

describe("JobList", () => {
  beforeEach(() => {
    mockUseSettings.mockReset();
  });

  it("shows job args by default", () => {
    const job = jobMinimalFactory.build();
    const features = createFeatures({
      jobListHideArgsByDefault: false,
    });

    // Mock settings with no override
    mockUseSettings.mockReturnValue(settingsMock({}));

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
    mockUseSettings.mockReturnValue(settingsMock({}));

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
    mockUseSettings.mockReturnValue(settingsMock({ showJobArgs: true }));

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
    mockUseSettings.mockReturnValue(settingsMock({ showJobArgs: false }));

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

  it("requires confirmation before deleting selected jobs", async () => {
    const jobs = [
      jobMinimalFactory.completed().build({ id: 1n }),
      jobMinimalFactory.completed().build({ id: 2n }),
    ];
    const deleteJobs = vi.fn();
    const user = userEvent.setup();
    const features = createFeatures({
      jobListHideArgsByDefault: false,
    });

    mockUseSettings.mockReturnValue(settingsMock({}));

    render(
      <FeaturesContext.Provider value={{ features }}>
        <JobList
          cancelJobs={vi.fn()}
          canShowFewer={false}
          canShowMore={false}
          deleteJobs={deleteJobs}
          jobs={jobs}
          retryJobs={vi.fn()}
          setJobRefetchesPaused={vi.fn()}
          showFewer={vi.fn()}
          showMore={vi.fn()}
          state={JobState.Completed}
          statesAndCounts={undefined}
        />
      </FeaturesContext.Provider>,
    );

    await act(async () => {
      await user.click(
        screen.getByRole("checkbox", { name: /select all jobs/i }),
      );
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /^delete$/i }));
    });

    expect(deleteJobs).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", {
      name: "Delete selected jobs?",
    });
    expect(
      within(dialog).getByText(/This permanently deletes 2 selected jobs/i),
    ).toBeInTheDocument();

    await act(async () => {
      await user.click(
        within(dialog).getByRole("button", { name: /delete jobs/i }),
      );
    });

    await waitFor(() => {
      expect(deleteJobs).toHaveBeenCalledWith(jobs.map((job) => job.id));
      expect(
        screen.queryByRole("dialog", { name: "Delete selected jobs?" }),
      ).not.toBeInTheDocument();
    });
  });
});

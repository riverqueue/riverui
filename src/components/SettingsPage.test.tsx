import { useFeatures } from "@contexts/Features.hook";
import { useSettings } from "@hooks/use-settings";
import { createFeatures } from "@test/utils/features";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsPage from "./SettingsPage";

// Mock useSettings hook
vi.mock("@hooks/use-settings", () => ({
  useSettings: vi.fn(),
}));

// Mock useFeatures hook
vi.mock("@contexts/Features.hook", () => ({
  useFeatures: vi.fn(),
}));

describe("SettingsPage", () => {
  it("renders correctly with default settings", () => {
    // Mock settings hook
    const mockSetShowJobArgs = vi.fn();
    const mockClearShowJobArgs = vi.fn();
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: {},
      shouldShowJobArgs: true,
    });

    // Mock features
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: false,
      }),
    });

    render(<SettingsPage />);

    // Title should be visible
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Settings section should be visible
    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("Job arguments")).toBeInTheDocument();
    expect(screen.getByTestId("job-args-label")).toBeInTheDocument();
    expect(screen.getByTestId("job-args-description")).toBeInTheDocument();
    expect(screen.getByTestId("job-args-toggle")).toBeInTheDocument();

    // Default value is only rendered when overriding, so it should not be present here
    expect(screen.queryByTestId("job-args-default")).not.toBeInTheDocument();

    // No "Reset to default" button when not overriding
    expect(screen.queryByTestId("job-args-reset-btn")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("job-args-override-msg"),
    ).not.toBeInTheDocument();
  });

  it("shows reset button when overriding default", () => {
    // Mock settings hook with override
    const mockSetShowJobArgs = vi.fn();
    const mockClearShowJobArgs = vi.fn();
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: { showJobArgs: true },
      shouldShowJobArgs: true,
    });

    // Mock features
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    render(<SettingsPage />);

    // Reset button should be visible
    expect(screen.getByTestId("job-args-reset-btn")).toBeInTheDocument();
    expect(screen.getByTestId("job-args-override-msg")).toBeInTheDocument();
    // Override message should contain the correct default value
    const overrideMsg = screen.getByTestId("job-args-override-msg").textContent;
    expect(overrideMsg).toMatch(
      /You're overriding the system default \(args (hidden|shown)\)\./,
    );
    expect(screen.getByTestId("job-args-reset-btn")).toHaveTextContent("Reset");

    // Click reset button
    fireEvent.click(screen.getByTestId("job-args-reset-btn"));
    expect(mockClearShowJobArgs).toHaveBeenCalledTimes(1);
  });

  it("toggles job args setting when switch is clicked", () => {
    // Mock settings hook
    const mockSetShowJobArgs = vi.fn();
    const mockClearShowJobArgs = vi.fn();
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: {},
      shouldShowJobArgs: false,
    });

    // Mock features
    (useFeatures as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    render(<SettingsPage />);

    // Find switch element by data-testid
    const switchElement = screen.getByTestId("job-args-toggle");
    expect(switchElement).toBeInTheDocument();

    // Click the switch
    fireEvent.click(switchElement);
    expect(mockSetShowJobArgs).toHaveBeenCalledWith(true);
  });
});

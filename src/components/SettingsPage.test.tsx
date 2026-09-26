import { getVersion, type Version } from "@services/version";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFeatures } from "@test/utils/features";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";

import SettingsPage from "./SettingsPage";

type UseFeatures = typeof import("@contexts/Features.hook").useFeatures;
type UseSettings = typeof import("@hooks/use-settings").useSettings;

const { mockUseFeatures, mockUseSettings } = vi.hoisted(() => ({
  mockUseFeatures: vi.fn() as MockedFunction<UseFeatures>,
  mockUseSettings: vi.fn() as MockedFunction<UseSettings>,
}));

// Mock useSettings hook
vi.mock("@hooks/use-settings", () => ({
  useSettings: mockUseSettings,
}));

// Mock useFeatures hook
vi.mock("@contexts/Features.hook", () => ({
  useFeatures: mockUseFeatures,
}));

vi.mock("@services/version", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@services/version")>()),
  getVersion: vi.fn(),
}));

const mockGetVersion = vi.mocked(getVersion);
const buildInfo: Version = {
  goVersion: "go1.26.7",
  modified: true,
  revision: "abc123def456",
  time: "2026-09-25T19:38:00Z",
  version: "v0.19.0",
};

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockUseFeatures.mockReset();
    mockUseSettings.mockReset();
    mockGetVersion.mockReset();
    // Leave the request pending unless a test supplies a response.
    mockGetVersion.mockImplementation(() => new Promise(() => {}));
    mockUseSettings.mockReturnValue({
      clearShowJobArgs: vi.fn(),
      setShowJobArgs: vi.fn(),
      settings: {},
      shouldShowJobArgs: true,
    });
    mockUseFeatures.mockReturnValue({
      features: createFeatures({ jobListHideArgsByDefault: false }),
    });
  });

  it("renders correctly with default settings", () => {
    // Mock settings hook
    const mockSetShowJobArgs = vi.fn();
    const mockClearShowJobArgs = vi.fn();
    mockUseSettings.mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: {},
      shouldShowJobArgs: true,
    });

    // Mock features
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: false,
      }),
    });

    renderSettingsPage();

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
    mockUseSettings.mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: { showJobArgs: true },
      shouldShowJobArgs: true,
    });

    // Mock features
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    renderSettingsPage();

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
    mockUseSettings.mockReturnValue({
      clearShowJobArgs: mockClearShowJobArgs,
      setShowJobArgs: mockSetShowJobArgs,
      settings: {},
      shouldShowJobArgs: false,
    });

    // Mock features
    mockUseFeatures.mockReturnValue({
      features: createFeatures({
        jobListHideArgsByDefault: true,
      }),
    });

    renderSettingsPage();

    // Find switch element by data-testid
    const switchElement = screen.getByTestId("job-args-toggle");
    expect(switchElement).toBeInTheDocument();

    // Click the switch
    fireEvent.click(switchElement);
    expect(mockSetShowJobArgs).toHaveBeenCalledWith(true);
  });

  it("displays build info when loaded", async () => {
    mockGetVersion.mockResolvedValue(buildInfo);

    renderSettingsPage();

    expect(await screen.findByTestId("build-version")).toHaveTextContent(
      "v0.19.0",
    );
    expect(screen.getByTestId("build-commit")).toHaveTextContent(
      "abc123def456 (modified)",
    );
    expect(screen.getByText("Commit date")).toBeInTheDocument();
    expect(screen.getByTestId("build-time")).toHaveTextContent(
      "2026-09-25T19:38:00Z",
    );
    expect(screen.getByTestId("build-go-version")).toHaveTextContent(
      "go1.26.7",
    );
  });

  it("shows loading state while build info loads", () => {
    renderSettingsPage();

    expect(screen.getByTestId("build-info-loading")).toBeInTheDocument();
  });

  it("shows an error and retries a failed request", async () => {
    mockGetVersion.mockRejectedValueOnce(new Error("Network error"));
    mockGetVersion.mockResolvedValue(buildInfo);

    renderSettingsPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load build info.",
    );
    expect(screen.queryByTestId("build-info-loading")).not.toBeInTheDocument();
    expect(screen.getByTestId("job-args-toggle")).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("build-version")).toHaveTextContent(
      "v0.19.0",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockGetVersion).toHaveBeenCalledTimes(2);
  });

  it("shows unknown metadata without a misleading modified suffix", async () => {
    mockGetVersion.mockResolvedValue({
      ...buildInfo,
      revision: "",
      time: "",
      version: "",
    });

    renderSettingsPage();

    expect(await screen.findByTestId("build-version")).toHaveTextContent(
      /^unknown$/,
    );
    expect(screen.getByTestId("build-commit")).toHaveTextContent(/^unknown$/);
    expect(screen.getByTestId("build-time")).toHaveTextContent(/^unknown$/);
  });
});

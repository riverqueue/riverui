import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRetryJobs } from "./use-retry-jobs";

const { mockRetryJobs, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockRetryJobs: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@services/jobs", () => ({
  retryJobs: mockRetryJobs,
}));

vi.mock("@services/toast", () => ({
  toastError: mockToastError,
  toastSuccess: mockToastSuccess,
}));

describe("useRetryJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps retry errors in the mutation and shows the API message", async () => {
    const error = new Error(
      "Job can't be retried because another active job has the same unique properties. Wait for it to finish or delete it before retrying.",
    );
    mockRetryJobs.mockRejectedValue(error);
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useRetryJobs({
          onSuccess,
          successMessage: "Job enqueued for retry",
        }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.mutate([123n]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith({
      message: "Job retry failed",
      subtext: error.message,
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, throwOnError: true } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

import {
  focusManager,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { refreshQueryOptions } from "./RefreshSettings.query";

describe("refreshQueryOptions", () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.restoreAllMocks();
  });

  it("prevents automatic focus refetches when live updates are paused", async () => {
    const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("loaded");
    const queryClient = renderQuery({ intervalMs: 0, queryFn });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it("allows automatic focus refetches when live updates are enabled", async () => {
    const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("loaded");
    const queryClient = renderQuery({ intervalMs: 2000, queryFn });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    queryClient.clear();
  });
});

const renderQuery = ({
  intervalMs,
  queryFn,
}: {
  intervalMs: number;
  queryFn: () => Promise<string>;
}): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Probe = () => {
    useQuery({
      queryFn,
      queryKey: ["refresh-settings-test"],
      ...refreshQueryOptions(intervalMs),
    });
    return null;
  };

  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );

  return queryClient;
};

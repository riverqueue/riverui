import { Filter, FilterTypeId } from "@components/job-search/JobSearch";
import { JobsIndexComponent, Route } from "@routes/jobs/index";
import { jobSearchSchema } from "@routes/jobs/index.schema";
import { listJobsKey } from "@services/jobs";
import { JobState } from "@services/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type JobListHarnessProps = {
  cancelJobs: (jobIDs: bigint[]) => void;
  deleteJobs: (jobIDs: bigint[]) => void;
  initialFilters?: Filter[];
  onFiltersChange?: (filters: Filter[]) => void;
  retryJobs: (jobIDs: bigint[]) => void;
};

type NavigateOptions = {
  search: (
    old: Record<string, JobState | string[] | undefined>,
  ) => Record<string, JobState | string[] | undefined>;
};

const {
  mockCancelJobs,
  mockCountsByState,
  mockDeleteJobs,
  mockJobList,
  mockListJobs,
  mockNavigate,
  mockUseRetryJobs,
} = vi.hoisted(() => ({
  mockCancelJobs: vi.fn(),
  mockCountsByState: vi.fn(),
  mockDeleteJobs: vi.fn(),
  mockJobList: vi.fn(),
  mockListJobs: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseRetryJobs: vi.fn(),
}));

vi.mock("@components/JobList", () => ({
  default: (props: JobListHarnessProps) => {
    mockJobList(props);
    return null;
  },
}));

vi.mock("@contexts/RefreshSettings.hook", () => ({
  useRefreshSetting: () => ({ intervalMs: 0 }),
}));

vi.mock("@hooks/use-retry-jobs", () => ({
  useRetryJobs: (opts: { onSuccess: () => void }) => {
    mockUseRetryJobs(opts);
    return { mutate: (_jobIDs: bigint[]) => opts.onSuccess() };
  },
}));

vi.mock("@services/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/jobs")>();
  return {
    ...actual,
    cancelJobs: mockCancelJobs,
    deleteJobs: mockDeleteJobs,
    listJobs: mockListJobs,
  };
});

vi.mock("@services/states", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@services/states")>();
  return {
    ...actual,
    countsByState: mockCountsByState,
  };
});

vi.mock("@services/toast", () => ({
  toastError: vi.fn(),
}));

const loaderDeps = {
  id: undefined,
  kind: ["email"],
  limit: 20,
  priority: [1],
  queue: ["default"],
  state: JobState.Running,
  tags: ["customer:123", "urgent"],
};

const activeJobsKey = listJobsKey({
  ids: loaderDeps.id,
  kinds: loaderDeps.kind,
  limit: loaderDeps.limit,
  priorities: loaderDeps.priority,
  queues: loaderDeps.queue,
  state: loaderDeps.state,
  tags: loaderDeps.tags,
});

const latestJobListProps = (): JobListHarnessProps => {
  const props = mockJobList.mock.calls.at(-1)?.[0] as
    JobListHarnessProps | undefined;
  expect(props).toBeDefined();
  if (!props) throw new Error("JobList was not rendered");
  return props;
};

const renderJobsIndex = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <JobsIndexComponent />
      </QueryClientProvider>,
    ),
  };
};

describe("Jobs Route Search Schema", () => {
  it("validates search parameters correctly", () => {
    // Test default values
    const defaultSearch = {};
    const defaultResult = jobSearchSchema.parse(defaultSearch);
    expect(defaultResult).toEqual({
      limit: 20,
      state: JobState.Running,
    });

    // Test valid limit
    const validLimitSearch = { limit: 40 };
    const validLimitResult = jobSearchSchema.parse(validLimitSearch);
    expect(validLimitResult).toEqual({
      limit: 40,
      state: JobState.Running,
    });

    // Test minimum limit
    const minLimitSearch = { limit: 20 };
    const minLimitResult = jobSearchSchema.parse(minLimitSearch);
    expect(minLimitResult).toEqual({
      limit: 20,
      state: JobState.Running,
    });

    // Test maximum limit
    const maxLimitSearch = { limit: 200 };
    const maxLimitResult = jobSearchSchema.parse(maxLimitSearch);
    expect(maxLimitResult).toEqual({
      limit: 200,
      state: JobState.Running,
    });

    // Test string limit (should be coerced to number)
    const stringLimitSearch = { limit: "40" };
    const stringLimitResult = jobSearchSchema.parse(stringLimitSearch);
    expect(stringLimitResult).toEqual({
      limit: 40,
      state: JobState.Running,
    });
  });

  it("handles invalid search parameters", () => {
    // Test limit below minimum
    expect(() => jobSearchSchema.parse({ limit: 10 })).toThrow();

    // Test limit above maximum
    expect(() => jobSearchSchema.parse({ limit: 300 })).toThrow();

    // Test invalid limit type
    expect(() => jobSearchSchema.parse({ limit: "invalid" })).toThrow();
  });

  it("normalizes tag filters", () => {
    expect(jobSearchSchema.parse({ tags: "urgent" })).toMatchObject({
      tags: ["urgent"],
    });
    expect(
      jobSearchSchema.parse({ tags: ["customer:123", "urgent"] }),
    ).toMatchObject({
      tags: ["customer:123", "urgent"],
    });
  });
});

describe("JobsIndexComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelJobs.mockResolvedValue(undefined);
    mockCountsByState.mockResolvedValue({});
    mockDeleteJobs.mockResolvedValue(undefined);
    mockListJobs.mockResolvedValue([]);
    vi.spyOn(Route, "useLoaderDeps").mockReturnValue(loaderDeps);
    vi.spyOn(Route, "useNavigate").mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round trips tags between route search and job filters", async () => {
    renderJobsIndex();

    await waitFor(() => expect(mockListJobs).toHaveBeenCalled());
    expect(mockListJobs.mock.calls.at(-1)?.[0]).toMatchObject({
      queryKey: activeJobsKey,
    });

    const props = latestJobListProps();
    expect(props.initialFilters).toEqual(
      expect.arrayContaining([
        {
          id: "tags-filter",
          match: "tags:",
          typeId: FilterTypeId.TAGS,
          values: loaderDeps.tags,
        },
      ]),
    );

    act(() => {
      props.onFiltersChange?.([
        {
          id: "replacement-tags",
          match: "tags:",
          typeId: FilterTypeId.TAGS,
          values: ["replacement"],
        },
      ]);
    });
    let navigateOpts = mockNavigate.mock.calls.at(-1)?.[0] as
      NavigateOptions | undefined;
    expect(navigateOpts?.search({ state: JobState.Running })).toMatchObject({
      tags: ["replacement"],
    });

    act(() => props.onFiltersChange?.([]));
    navigateOpts = mockNavigate.mock.calls.at(-1)?.[0] as
      NavigateOptions | undefined;
    expect(
      navigateOpts?.search({
        state: JobState.Running,
        tags: loaderDeps.tags,
      }),
    ).toEqual({
      id: undefined,
      kind: undefined,
      priority: undefined,
      queue: undefined,
      state: JobState.Running,
      tags: undefined,
    });
  });

  it("refreshes the active tag-filtered query after mutations", async () => {
    const { queryClient } = renderJobsIndex();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const removeQueries = vi.spyOn(queryClient, "removeQueries");

    await waitFor(() => expect(mockListJobs).toHaveBeenCalled());
    const props = latestJobListProps();

    act(() => props.cancelJobs([123n]));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: activeJobsKey,
      }),
    );

    act(() => props.deleteJobs([123n]));
    await waitFor(() =>
      expect(removeQueries).toHaveBeenCalledWith({
        queryKey: activeJobsKey,
      }),
    );

    invalidateQueries.mockClear();
    act(() => props.retryJobs([123n]));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: activeJobsKey,
    });
  });
});

import Layout from "@components/Layout";
import { FeaturesContext } from "@contexts/Features";
import { SidebarSettingProvider } from "@contexts/SidebarSetting.provider";
import {
  deadLetterJobRouteSearchSchema,
  deadLetterJobSearchSchema,
} from "@routes/dead-letter-jobs/index.schema";
import { listDeadLetterJobsKey } from "@services/deadLetterJobs";
import { featuresKey } from "@services/features";
import { Job, listJobs, listJobsKey } from "@services/jobs";
import { countsByState, StatesAndCounts } from "@services/states";
import { toastError } from "@services/toast";
import { JobState } from "@services/types";
import {
  QueryClient,
  QueryClientProvider,
  QueryFunctionContext,
} from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { jobFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { APIResponseError, NotFoundError } from "@utils/api";
import qs from "query-string";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../global-type-overrides";
import { routeTree } from "../routeTree.gen";

const {
  fetchDeadLetterSuggestions,
  getDeadLetterJob,
  listDeadLetterJobs,
  retryDeadLetterJob,
} = vi.hoisted(() => ({
  fetchDeadLetterSuggestions: vi.fn(),
  getDeadLetterJob: vi.fn(),
  listDeadLetterJobs: vi.fn(),
  retryDeadLetterJob: vi.fn(),
}));

vi.mock("@services/deadLetterJobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@services/deadLetterJobs")>()),
  fetchDeadLetterSuggestions,
  getDeadLetterJob,
  listDeadLetterJobs,
  retryDeadLetterJob,
}));
vi.mock("@components/Root", () => ({
  Root: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
}));
vi.mock("@components/TopNavTitleOnly", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@contexts/RefreshSettings.hook", () => ({
  useRefreshSetting: () => ({ intervalMs: 0 }),
}));
vi.mock("@services/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@services/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@services/jobs")>()),
  getJob: vi.fn(),
  listJobs: vi.fn(),
}));
vi.mock("@services/states", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@services/states")>()),
  countsByState: vi.fn(),
}));

const job = jobFactory.discarded().build({
  argsRaw: '{"id":1970670598291982290}',
  id: 1970670598291982290n,
  kind: "send_email",
  queue: "mail",
});

async function renderRoute(path: string, pro = true) {
  const features = createFeatures({ deadLetterJobs: pro });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(featuresKey(), features);
  const router = createRouter({
    context: { features, queryClient },
    defaultPendingMinMs: 0,
    history: createMemoryHistory({ initialEntries: [path] }),
    parseSearch: (search) => qs.parse(search, { arrayFormat: "comma" }),
    stringifySearch: (search) => {
      const result = qs.stringify(search, {
        arrayFormat: "comma",
        skipEmptyString: true,
      });
      return result ? `?${result}` : "";
    },
    routeTree,
  });
  await act(async () => {
    await router.load();
    render(
      <QueryClientProvider client={queryClient}>
        <FeaturesContext.Provider value={{ features }}>
          <SidebarSettingProvider>
            <RouterProvider router={router} />
          </SidebarSettingProvider>
        </FeaturesContext.Provider>
      </QueryClientProvider>,
    );
  });
  return { queryClient, router };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchDeadLetterSuggestions.mockResolvedValue([]);
  listDeadLetterJobs.mockResolvedValue([job]);
  getDeadLetterJob.mockResolvedValue(job);
  vi.mocked(listJobs).mockResolvedValue([]);
  const zero = { accuracy: "exact", count: 0n } as const;
  const counts: StatesAndCounts = {
    available: zero,
    cancelled: zero,
    completed: zero,
    discarded: zero,
    pending: zero,
    retryable: zero,
    running: zero,
    scheduled: zero,
  };
  vi.mocked(countsByState).mockResolvedValue(counts);
});

describe("Dead letter jobs", () => {
  const filteredSearch =
    "?id=1970670598291982290&kind=send_email&queue=mail&priority=1,3&tags=batch,urgent&limit=40";

  it("clears filters and pagination when navigating from Dead Letters to Jobs", async () => {
    const { router, queryClient } = await renderRoute(
      "/dead-letter-jobs" + filteredSearch,
    );
    const jobsLink = screen.getByRole("link", { name: "Jobs" });
    expect(jobsLink).toHaveAttribute("href", "/jobs");
    await act(async () => {
      fireEvent.click(jobsLink);
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/jobs"));
    expect(router.state.location.search).toEqual({});
    expect(await screen.findByTestId("job-search-input")).toHaveValue("");
    expect(
      queryClient.getQueryData(
        listJobsKey({ limit: 20, state: JobState.Running }),
      ),
    ).toEqual([]);
    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: listJobsKey({ limit: 20, state: JobState.Running }),
      }),
    );
  });

  it("clears filters and pagination when navigating from Jobs to Dead Letters", async () => {
    const { router } = await renderRoute(
      "/jobs" + filteredSearch + "&state=discarded",
    );
    const deadLettersLink = screen.getByRole("link", { name: "Dead Letters" });
    expect(deadLettersLink).toHaveAttribute("href", "/dead-letter-jobs");
    await act(async () => {
      fireEvent.click(deadLettersLink);
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/dead-letter-jobs"),
    );
    expect(router.state.location.search).toEqual({});
    expect(await screen.findByTestId("job-search-input")).toHaveValue("");
    expect(listDeadLetterJobs).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: listDeadLetterJobsKey(20) }),
    );
  });

  it("preserves filters and pagination between job states and within the Jobs pane", async () => {
    const { router } = await renderRoute("/jobs" + filteredSearch);
    const filters = router.state.location.search;
    const input = await screen.findByTestId("job-search-input");
    const initialText = input.getAttribute("value");
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Discarded" }));
    });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        ...filters,
        state: JobState.Discarded,
      }),
    );
    expect(await screen.findByTestId("job-search-input")).toHaveValue(
      initialText,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Jobs" }));
    });
    await waitFor(() => expect(router.state.location.search).toEqual(filters));
    expect(await screen.findByTestId("job-search-input")).toHaveValue(
      initialText,
    );
  });

  it.each(["/dead-letter-jobs", `/dead-letter-jobs/${job.id}`])(
    "hides navigation and blocks OSS access to %s",
    async (path) => {
      await renderRoute(path, false);
      expect(
        screen.queryByRole("link", { name: "Dead Letters" }),
      ).not.toBeInTheDocument();
      expect(listDeadLetterJobs).not.toHaveBeenCalled();
      expect(getDeadLetterJob).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "Page not found" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Return to job list" }),
      ).toHaveAttribute("href", "/jobs");
    },
  );

  it("shows the Pro navigation and opens the selected dead letter job", async () => {
    const { router } = await renderRoute("/dead-letter-jobs");
    expect(
      screen.getByRole("link", { name: "Dead Letters" }),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("link", { name: `send_email #${job.id}` }),
      );
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/dead-letter-jobs/${job.id}`,
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Retry job" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Args").parentElement).toHaveTextContent(
      "1970670598291982290",
    );
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty queue", async () => {
    listDeadLetterJobs.mockResolvedValue([]);
    await renderRoute("/dead-letter-jobs");
    expect(screen.getByText("No dead letter jobs.")).toBeInTheDocument();
  });

  it("requests larger and smaller bounded lists and keeps the limit in the URL", async () => {
    const jobs = Array.from({ length: 65 }, (_, i) => ({
      ...job,
      id: BigInt(i + 1),
    }));
    listDeadLetterJobs.mockImplementation(
      ({
        queryKey,
      }: QueryFunctionContext<ReturnType<typeof listDeadLetterJobsKey>>) =>
        jobs.slice(0, queryKey[1]?.limit ?? 20),
    );
    const { queryClient, router } = await renderRoute("/dead-letter-jobs");
    expect(screen.getAllByRole("link", { name: /^send_email #/ })).toHaveLength(
      20,
    );
    expect(screen.getByRole("button", { name: "Fewer" })).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "More" }));
    });
    await screen.findByRole("link", { name: "send_email #40" });
    expect(screen.getAllByRole("link", { name: /^send_email #/ })).toHaveLength(
      40,
    );
    expect(router.state.location.search).toEqual({ limit: "40" });
    expect(queryClient.getQueryData(listDeadLetterJobsKey(20))).toHaveLength(
      20,
    );
    expect(queryClient.getQueryData(listDeadLetterJobsKey(40))).toHaveLength(
      40,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fewer" }));
    });
    await waitFor(() =>
      expect(
        screen.getAllByRole("link", { name: /^send_email #/ }),
      ).toHaveLength(20),
    );
    expect(router.state.location.search).toEqual({});
  });

  it("honors a bookmarked limit and caps the controls at 200", async () => {
    const { router } = await renderRoute("/dead-letter-jobs?limit=200");
    expect(listDeadLetterJobs).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: listDeadLetterJobsKey(200) }),
    );
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fewer" })).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fewer" }));
    });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ limit: "180" }),
    );
  });

  it("disables More when the query returns fewer jobs than the limit", async () => {
    await renderRoute("/dead-letter-jobs");
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });

  it("normalizes invalid limits and accepts numeric strings", () => {
    for (const limit of [undefined, "bad", -1, 0, 19, 201, 20.5]) {
      expect(deadLetterJobSearchSchema.parse({ limit })).toEqual({ limit: 20 });
    }
    expect(deadLetterJobSearchSchema.parse({ limit: "40" })).toEqual({
      limit: 40,
    });
  });

  it("restores bookmarked filters and preserves them while paginating", async () => {
    listDeadLetterJobs.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ ...job, id: BigInt(i + 1) })),
    );
    const { router, queryClient } = await renderRoute(
      "/dead-letter-jobs?kind=send_email,report&queue=mail&priority=1,3&tags=urgent&id=1970670598291982290",
    );
    const filters = {
      ids: ["1970670598291982290"],
      kinds: ["report", "send_email"],
      priorities: ["1", "3"],
      queues: ["mail"],
      tags: ["urgent"],
    };
    expect(
      queryClient.getQueryData(listDeadLetterJobsKey(20, filters)),
    ).toHaveLength(40);
    expect(screen.getByTestId("job-search-input")).toHaveValue(
      "id:1970670598291982290 kind:report,send_email priority:1,3 queue:mail tags:urgent",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "More" }));
    });
    await waitFor(() =>
      expect(
        queryClient.getQueryData(listDeadLetterJobsKey(40, filters)),
      ).toHaveLength(40),
    );
    expect(router.state.location.search).toMatchObject({
      limit: "40",
      kind: ["report", "send_email"],
      queue: "mail",
    });
  });

  it("applies edited filters, distinguishes empty results, and clears the search", async () => {
    const { router, queryClient } = await renderRoute("/dead-letter-jobs");
    listDeadLetterJobs.mockResolvedValue([]);
    fireEvent.change(screen.getByTestId("job-search-input"), {
      target: { value: "kind:report queue:mail tags:urgent,batch priority:2" },
    });
    await screen.findByText("No dead letter jobs match these filters.");
    expect(router.state.location.search).toMatchObject({
      kind: "report",
      queue: "mail",
      tags: ["batch", "urgent"],
      priority: "2",
    });
    expect(
      queryClient.getQueryData(
        listDeadLetterJobsKey(20, {
          kinds: ["report"],
          queues: ["mail"],
          tags: ["batch", "urgent"],
          priorities: ["2"],
        }),
      ),
    ).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await screen.findByRole("link", { name: `send_email #${job.id}` });
    expect(router.state.location.search).toEqual({});
  });

  it("restores the search field on browser Back", async () => {
    const { router } = await renderRoute("/dead-letter-jobs?queue=mail");
    await act(async () => {
      await router.navigate({
        to: "/dead-letter-jobs",
        search: { kind: ["report"] },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId("job-search-input")).toHaveValue("kind:report"),
    );
    await act(async () => {
      router.history.back();
    });
    await waitFor(() =>
      expect(screen.getByTestId("job-search-input")).toHaveValue("queue:mail"),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(router.state.location.search).toEqual({ queue: "mail" });
  });

  it("shows invalid numeric filters without issuing a misleading unfiltered query", async () => {
    const { router } = await renderRoute("/dead-letter-jobs?queue=mail");
    listDeadLetterJobs.mockClear();
    fireEvent.change(screen.getByTestId("job-search-input"), {
      target: { value: "id:bad" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Job IDs must be positive integers.",
    );
    expect(router.state.location.search).toEqual({ queue: "mail" });
    expect(listDeadLetterJobs).not.toHaveBeenCalled();
  });

  it("uses dead letter autocomplete for kinds and queues", async () => {
    await renderRoute("/dead-letter-jobs");
    fetchDeadLetterSuggestions.mockResolvedValue(["archive_report"]);
    const input = screen.getByTestId("job-search-input");
    fireEvent.change(input, { target: { value: "kind:archive_" } });
    await waitFor(() =>
      expect(fetchDeadLetterSuggestions).toHaveBeenCalledWith(
        "job_kind",
        "archive_",
        [],
        expect.any(AbortSignal),
      ),
    );
    fireEvent.change(input, { target: { value: "queue:mail,re" } });
    await waitFor(() =>
      expect(fetchDeadLetterSuggestions).toHaveBeenCalledWith(
        "queue_name",
        "re",
        ["mail"],
        expect.any(AbortSignal),
      ),
    );
  });

  it("validates and normalizes filter values without losing ID precision", () => {
    expect(
      deadLetterJobSearchSchema.parse({
        id: "9223372036854775807",
        kind: ["report", "email", "report"],
        tags: [],
      }),
    ).toEqual({
      limit: 20,
      id: ["9223372036854775807"],
      kind: ["email", "report"],
      tags: undefined,
    });
    for (const id of ["bad", "1.5", "0", "-1", "9223372036854775808"])
      expect(deadLetterJobSearchSchema.safeParse({ id }).success).toBe(false);
    for (const priority of ["bad", "0", "5", "1.5"])
      expect(deadLetterJobSearchSchema.safeParse({ priority }).success).toBe(
        false,
      );
    // The route schema drops only the filters it can't parse.
    expect(
      deadLetterJobRouteSearchSchema.parse({
        id: "bad",
        kind: "report",
        priority: "5",
      }),
    ).toEqual({ limit: 20, kind: ["report"] });
  });

  it("retries through the Pro API and opens the newly created job", async () => {
    let finishRetry: ((value: Job) => void) | undefined;
    retryDeadLetterJob.mockImplementation(
      () =>
        new Promise<Job>((resolve) => {
          finishRetry = resolve;
        }),
    );
    const { queryClient, router } = await renderRoute(
      `/dead-letter-jobs/${job.id}`,
    );
    queryClient.setQueryData(listDeadLetterJobsKey(20), [job]);
    queryClient.setQueryData(listDeadLetterJobsKey(40), [job]);
    const filteredKey = listDeadLetterJobsKey(20, { queues: ["mail"] });
    queryClient.setQueryData(filteredKey, [job]);
    queryClient.setQueryData(["listJobs"], [job]);
    queryClient.setQueryData(["countsByState"], {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry job" }));
    });
    expect(
      await screen.findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(retryDeadLetterJob).toHaveBeenCalledWith(job.id, expect.anything());
    const newJob = jobFactory
      .available()
      .build({ id: job.id + 1n, kind: job.kind });
    await act(async () => {
      finishRetry?.(newJob);
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/jobs/${newJob.id}`),
    );
    expect(
      queryClient.getQueryData(["getDeadLetterJob", job.id.toString()]),
    ).toBeUndefined();
    expect(
      queryClient.getQueryState(listDeadLetterJobsKey(20))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(listDeadLetterJobsKey(40))?.isInvalidated,
    ).toBe(true);
    expect(queryClient.getQueryState(["listJobs"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(filteredKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["countsByState"])?.isInvalidated).toBe(
      true,
    );
  });

  it("keeps the job open and displays retry errors", async () => {
    retryDeadLetterJob.mockRejectedValue(
      new APIResponseError(
        "Another active job has the same unique properties.",
        409,
        "Conflict",
      ),
    );
    const { router } = await renderRoute(`/dead-letter-jobs/${job.id}`);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry job" }));
    });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith({
        message: "Job retry failed",
        subtext: "Another active job has the same unique properties.",
      }),
    );
    expect(router.state.location.pathname).toBe(`/dead-letter-jobs/${job.id}`);
    expect(screen.getByRole("button", { name: "Retry job" })).toBeEnabled();
  });

  it("handles a job already retried elsewhere", async () => {
    getDeadLetterJob.mockRejectedValue(
      new NotFoundError("This dead letter job has already been retried."),
    );
    await renderRoute(`/dead-letter-jobs/${job.id}`);
    expect(
      screen.getByText("This dead letter job has already been retried."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to dead letters" }),
    ).toHaveAttribute("href", "/dead-letter-jobs");
  });
});

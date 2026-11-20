import type { JobSequenceStatus } from "@services/sequences";

import { JobComponent, Route } from "@routes/jobs/$jobId";
import { getJobKey } from "@services/jobs";
import { JobState } from "@services/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { jobFactory } from "@test/factories/job";
import { jobSequence } from "@test/factories/sequence";
import { createFeatures } from "@test/utils/features";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { featureState, getJob, getSequence, refreshState } = vi.hoisted(() => ({
  featureState: { enabled: true },
  getJob: vi.fn(),
  getSequence: vi.fn(),
  refreshState: { intervalMs: 0 },
}));

vi.mock("@contexts/Features.hook", () => ({
  useFeatures: () => ({
    features: createFeatures({ sequenceQueries: featureState.enabled }),
  }),
}));
vi.mock("@contexts/RefreshSettings.hook", () => ({
  useRefreshSetting: () => ({ intervalMs: refreshState.intervalMs }),
}));
vi.mock("@services/sequences", async (original) => ({
  ...(await original<typeof import("@services/sequences")>()),
  getJobSequence: getSequence,
}));
vi.mock("@components/JobDetail", () => ({
  default: ({
    retry,
    sequence,
  }: {
    retry: () => void;
    sequence?: JobSequenceStatus;
  }) => (
    <div>
      Job details<button onClick={retry}>Retry</button>
      {sequence && (
        <span>
          {sequence.error
            ? "Sequence unavailable"
            : sequence.jobSequence?.waitReason}
        </span>
      )}
    </div>
  ),
}));
vi.mock("@hooks/use-retry-jobs", () => ({
  useRetryJobs: ({ onSuccess }: { onSuccess: () => void }) => ({
    mutate: onSuccess,
  }),
}));

const job = jobFactory.pending().build({ metadata: { seq_key: "order" } });

beforeEach(() => {
  featureState.enabled = true;
  refreshState.intervalMs = 0;
  getJob.mockReset().mockResolvedValue(job);
  getSequence
    .mockReset()
    .mockResolvedValue(jobSequence({ jobId: job.id, waitReason: "up_next" }));
  vi.spyOn(Route, "useParams").mockReturnValue({ jobId: job.id });
  vi.spyOn(Route, "useNavigate").mockReturnValue(vi.fn());
  vi.spyOn(Route, "useRouteContext").mockReturnValue({
    queryOptions: { queryFn: getJob, queryKey: getJobKey(job.id) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderJob() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <JobComponent />
    </QueryClientProvider>,
  );
  return client;
}

test("loads a sequence job's status and refreshes it after retry", async () => {
  renderJob();
  await screen.findByText("up_next");
  expect(getSequence).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => {
    expect(getSequence).toHaveBeenCalledTimes(2);
  });
});

test("doesn't request a sequence from a backend without sequence queries", async () => {
  featureState.enabled = false;
  renderJob();
  await screen.findByText("Job details");
  expect(getSequence).not.toHaveBeenCalled();
});

test("doesn't request a sequence for a job outside one", async () => {
  getJob.mockResolvedValue({ ...job, metadata: {} });
  renderJob();
  await screen.findByText("Job details");
  expect(getSequence).not.toHaveBeenCalled();
});

test("keeps the job page usable when the sequence fails to load", async () => {
  getSequence.mockRejectedValue(new Error("Query timed out"));
  renderJob();
  await screen.findByText("Sequence unavailable");
  expect(screen.getByText("Job details")).toBeInTheDocument();
});

test("polls the sequence only while the job is pending", async () => {
  refreshState.intervalMs = 2000;
  const client = renderJob();
  await screen.findByText("up_next");
  const query = client
    .getQueryCache()
    .find({ queryKey: ["jobSequence", job.id.toString(), "pending"] });
  expect(query?.options).toMatchObject({ refetchInterval: 2000 });
});

test("loads the sequence once for a job that isn't pending", async () => {
  refreshState.intervalMs = 2000;
  getJob.mockResolvedValue({ ...job, state: JobState.Cancelled });
  const client = renderJob();
  await screen.findByText("up_next");
  const query = client
    .getQueryCache()
    .find({ queryKey: ["jobSequence", job.id.toString(), "cancelled"] });
  expect(query?.options).toMatchObject({
    refetchInterval: false,
    staleTime: Infinity,
  });
});

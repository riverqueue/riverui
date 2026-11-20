import type { ReactNode } from "react";

import { JobComponent, Route } from "@routes/jobs/$jobId";
import { getJobKey } from "@services/jobs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { jobFactory } from "@test/factories/job";
import { createFeatures } from "@test/utils/features";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { getSequence, featureState, getJob } = vi.hoisted(() => ({
  featureState: { enabled: true },
  getJob: vi.fn(),
  getSequence: vi.fn(),
}));

vi.mock("@contexts/Features.hook", () => ({
  useFeatures: () => ({
    features: createFeatures({ sequenceQueries: featureState.enabled }),
  }),
}));
vi.mock("@contexts/RefreshSettings.hook", () => ({
  useRefreshSetting: () => ({ intervalMs: 0 }),
}));
vi.mock("@services/sequences", async (original) => ({
  ...(await original<typeof import("@services/sequences")>()),
  getJobSequence: getSequence,
}));
vi.mock("@components/JobDetail", () => ({
  default: ({
    retry,
    sequenceDetails,
  }: {
    retry: () => void;
    sequenceDetails?: ReactNode;
  }) => (
    <div>
      Job details<button onClick={retry}>Retry</button>
      {sequenceDetails}
    </div>
  ),
}));
vi.mock("@components/SequenceDetails", () => ({
  default: ({
    error,
    sequence,
  }: {
    error?: boolean;
    sequence?: { waitReason: string };
  }) => <div>{error ? "Diagnostics unavailable" : sequence?.waitReason}</div>,
}));
vi.mock("@hooks/use-retry-jobs", () => ({
  useRetryJobs: ({ onSuccess }: { onSuccess: () => void }) => ({
    mutate: onSuccess,
  }),
}));

const job = jobFactory.pending().build({ metadata: { seq_key: "invoice" } });

beforeEach(() => {
  featureState.enabled = true;
  getJob.mockReset().mockResolvedValue(job);
  getSequence.mockReset().mockResolvedValue({
    blockers: [],
    firstPending: null,
    jobId: job.id,
    key: "invoice",
    waitReason: "waiting",
  });
  vi.spyOn(Route, "useParams").mockReturnValue({ jobId: job.id });
  vi.spyOn(Route, "useNavigate").mockReturnValue(vi.fn());
  vi.spyOn(Route, "useRouteContext").mockReturnValue({
    queryOptions: { queryKey: getJobKey(job.id), queryFn: getJob },
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

test("loads diagnostics for a sequence job and refreshes them after retry", async () => {
  renderJob();
  await screen.findByText("waiting");
  expect(getSequence).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => {
    expect(getSequence).toHaveBeenCalledTimes(2);
  });
});

test("does not request diagnostics from a backend without sequence support", async () => {
  featureState.enabled = false;
  renderJob();
  await screen.findByText("Job details");
  expect(getSequence).not.toHaveBeenCalled();
});

test("does not request diagnostics for an ordinary job", async () => {
  getJob.mockResolvedValue({ ...job, metadata: {} });
  renderJob();
  await screen.findByText("Job details");
  expect(getSequence).not.toHaveBeenCalled();
});

test("keeps the job page usable when sequence diagnostics fail", async () => {
  getSequence.mockRejectedValue(new Error("Query timed out"));
  renderJob();
  await screen.findByText("Diagnostics unavailable");
  expect(screen.getByText("Job details")).toBeInTheDocument();
});

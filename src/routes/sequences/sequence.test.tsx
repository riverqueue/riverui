import type { SequenceDetailProps } from "@components/SequenceDetail";

import {
  initialSequenceWindow,
  Route,
  SEQUENCE_PAGE_SIZE,
  sequenceCanChange,
  SequenceComponent,
} from "@routes/sequences/$sequenceKey";
import { JobState } from "@services/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  haltedSequenceFixture,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
  sequenceListItem,
} from "@test/factories/sequence";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { getInspection, listJobs, page, refreshState, retry } = vi.hoisted(
  () => ({
    getInspection: vi.fn(),
    listJobs: vi.fn(),
    page: { props: undefined as SequenceDetailProps | undefined },
    refreshState: { intervalMs: 0 },
    retry: vi.fn(),
  }),
);

vi.mock("@contexts/RefreshSettings.hook", () => ({
  useRefreshSetting: () => ({ intervalMs: refreshState.intervalMs }),
}));
vi.mock("@services/sequences", async (original) => ({
  ...(await original<typeof import("@services/sequences")>()),
  getSequenceInspection: getInspection,
  listSequenceJobs: listJobs,
}));
vi.mock("@components/SequenceDetail", () => ({
  default: (props: SequenceDetailProps) => {
    page.props = props;
    return <div>{props.jobs.map((job) => `#${job.id}`).join(" ")}</div>;
  },
}));
vi.mock("@hooks/use-retry-jobs", () => ({
  useRetryJobs: ({ onSuccess }: { onSuccess: () => void }) => ({
    mutate: (ids: bigint[]) => {
      retry(ids);
      return onSuccess();
    },
  }),
}));

const props = () => {
  if (!page.props) throw new Error("Page not rendered");
  return page.props;
};

beforeEach(() => {
  page.props = undefined;
  refreshState.intervalMs = 0;
  getInspection.mockReset().mockResolvedValue(haltedSequenceFixture.inspection);
  listJobs.mockReset().mockResolvedValue({
    hasLater: true,
    hasEarlier: true,
    jobs: haltedSequenceFixture.jobs,
  });
  vi.spyOn(Route, "useParams").mockReturnValue({
    sequenceKey: sequenceKeyFixture,
  });
  vi.spyOn(Route, "useSearch").mockReturnValue({ job: 7010n });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSequence() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SequenceComponent />
    </QueryClientProvider>,
  );
  return client;
}

describe("initialSequenceWindow", () => {
  test("starts at the halting job", () => {
    expect(
      initialSequenceWindow(haltedSequenceFixture.inspection, 7010n),
    ).toEqual({
      cursor: { afterId: 7000n },
      limit: SEQUENCE_PAGE_SIZE,
    });
  });

  test("starts at the earliest blocking or pending job", () => {
    const inspection = sequenceInspection({
      blockers: [sequenceJob(7002n, JobState.Running)],
      head: sequenceJob(6999n, JobState.Pending),
    });
    expect(initialSequenceWindow(inspection).cursor).toEqual({
      afterId: 6998n,
    });
  });

  test("lists from the first job when it has ID 1", () => {
    const inspection = sequenceInspection({
      haltedBy: sequenceJob(1n, JobState.Cancelled),
    });
    expect(initialSequenceWindow(inspection).cursor).toEqual({ afterId: 0n });
  });

  test("falls back to the selected job, then the newest jobs", () => {
    expect(initialSequenceWindow(sequenceInspection(), 6996n).cursor).toEqual({
      afterId: 6995n,
    });
    expect(initialSequenceWindow(sequenceInspection()).cursor).toEqual({
      newest: true,
    });
  });
});

test("sequenceCanChange only while a job is active or the head can run", () => {
  expect(sequenceCanChange(haltedSequenceFixture.inspection)).toBe(false);
  expect(sequenceCanChange(sequenceInspection())).toBe(false);
  expect(
    sequenceCanChange(
      sequenceInspection({ head: sequenceJob(7003n, JobState.Pending) }),
    ),
  ).toBe(true);
  expect(
    sequenceCanChange(
      sequenceInspection({
        blockers: [sequenceJob(7002n, JobState.Retryable)],
        haltedBy: sequenceJob(7001n, JobState.Cancelled),
      }),
    ),
  ).toBe(true);
});

test("loads jobs from the halting job and outlines the selected job", async () => {
  renderSequence();
  await screen.findByText("#7001 #7003 #7010 #7022");
  expect(listJobs).toHaveBeenCalledWith(
    sequenceKeyFixture,
    { afterId: 7000n },
    SEQUENCE_PAGE_SIZE,
    expect.anything(),
  );
  expect(props().selectedJobId).toBe(7010n);
  expect(props().hasEarlier).toBe(true);
});

test("shows earlier jobs by widening the loaded range", async () => {
  renderSequence();
  await screen.findByText("#7001 #7003 #7010 #7022");
  const earlier = [
    sequenceListItem(6990n, JobState.Completed, 900, "placed"),
    sequenceListItem(6996n, JobState.Completed, 600, "paid"),
  ];
  listJobs.mockImplementation((_key, cursor: object) =>
    Promise.resolve(
      "beforeId" in cursor
        ? { hasLater: true, hasEarlier: false, jobs: earlier }
        : {
            hasLater: true,
            hasEarlier: false,
            jobs: [...earlier, ...haltedSequenceFixture.jobs],
          },
    ),
  );

  await act(async () => props().onShowEarlier());
  await screen.findByText("#6990 #6996 #7001 #7003 #7010 #7022");
  expect(listJobs).toHaveBeenCalledWith(
    sequenceKeyFixture,
    { beforeId: 7001n },
    SEQUENCE_PAGE_SIZE,
    expect.anything(),
  );
  expect(listJobs).toHaveBeenLastCalledWith(
    sequenceKeyFixture,
    { afterId: 6989n },
    6,
    expect.anything(),
  );
});

test("shows later jobs by loading a longer range", async () => {
  renderSequence();
  await screen.findByText("#7001 #7003 #7010 #7022");
  act(() => props().onShowLater());
  await waitFor(() => {
    expect(listJobs).toHaveBeenLastCalledWith(
      sequenceKeyFixture,
      { afterId: 7000n },
      SEQUENCE_PAGE_SIZE * 2,
      expect.anything(),
    );
  });
});

test("polls only while the sequence can change", async () => {
  refreshState.intervalMs = 2000;
  const client = renderSequence();
  await screen.findByText("#7001 #7003 #7010 #7022");
  const query = client
    .getQueryCache()
    .find({ queryKey: ["sequence", sequenceKeyFixture, "inspection"] });
  if (!query) throw new Error("Expected an inspection query");
  const interval = query.observers[0]?.options.refetchInterval;
  if (typeof interval !== "function") throw new Error("Expected a function");
  expect(interval(query)).toBe(false);

  query.setData(
    sequenceInspection({ blockers: [sequenceJob(7002n, JobState.Running)] }),
  );
  expect(interval(query)).toBe(2000);
});

test("retrying the halting job reloads the sequence", async () => {
  renderSequence();
  await screen.findByText("#7001 #7003 #7010 #7022");
  expect(getInspection).toHaveBeenCalledTimes(1);
  act(() => props().onRemoveHalt(7001n, "retry"));
  expect(retry).toHaveBeenCalledWith([7001n]);
  await waitFor(() => {
    expect(getInspection).toHaveBeenCalledTimes(2);
  });
});

import SequenceDetail from "@components/SequenceDetail";
import { useRefreshSetting } from "@contexts/RefreshSettings.hook";
import { refreshQueryOptions } from "@contexts/RefreshSettings.query";
import { useRetryJobs } from "@hooks/use-retry-jobs";
import { deleteJobs, getJobKey } from "@services/jobs";
import {
  getSequenceInspection,
  isActiveState,
  listSequenceJobs,
  type SequenceInspection,
  sequenceInspectionKey,
  type SequenceJobListCursor,
  sequenceJobListKey,
  type SequenceJobListPage,
  sequenceKeyPrefix,
} from "@services/sequences";
import { toastError, toastSuccess } from "@services/toast";

const getJobKeyPrefix = ["getJob"] as const;
const jobSequenceKeyPrefix = ["jobSequence"] as const;
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const sequenceSearchSchema = z.object({
  // The job the operator came from, outlined in the list.
  job: z.coerce.bigint().positive().optional(),
});

export const Route = createFileRoute("/sequences/$sequenceKey")({
  validateSearch: sequenceSearchSchema,
  component: SequenceComponent,
});

// Jobs load in pages of this size, and the loaded range never grows past the
// API's maximum page, so polling refreshes it with a single request.
export const SEQUENCE_PAGE_SIZE = 100;
export const SEQUENCE_WINDOW_MAX = 1000;

// SequenceWindow is the contiguous range of jobs loaded on the page.
type SequenceWindow = { cursor: SequenceJobListCursor; limit: number };

// initialSequenceWindow starts at the earliest job that explains the
// sequence's state: the halting job, the first blocking job, or the next
// pending job. The job the operator came from is the fallback, and a sequence
// with none of those shows its newest jobs.
export const initialSequenceWindow = (
  inspection: SequenceInspection,
  selectedJobId?: bigint,
): SequenceWindow => {
  const candidates = [
    inspection.haltedBy?.id,
    inspection.blockers[0]?.id,
    inspection.head?.id,
  ].filter((id): id is bigint => id !== undefined);
  const anchor = candidates.length
    ? candidates.reduce((min, id) => (id < min ? id : min))
    : selectedJobId;
  return anchor === undefined
    ? { cursor: { newest: true }, limit: SEQUENCE_PAGE_SIZE }
    : { cursor: { afterId: anchor - 1n }, limit: SEQUENCE_PAGE_SIZE };
};

// A sequence changes on its own only while a job in it is active, or while
// its next pending job isn't held by a halting job. Otherwise it changes only
// through actions like a retry, which refresh the page themselves.
export const sequenceCanChange = (inspection?: SequenceInspection) =>
  !inspection ||
  inspection.blockers.some((job) => isActiveState(job.state)) ||
  (!!inspection.head && !inspection.haltedBy);

export function SequenceComponent() {
  const { sequenceKey } = Route.useParams();
  const { job: selectedJobId } = Route.useSearch();
  const queryClient = useQueryClient();
  const refreshSettings = useRefreshSetting();

  const [range, setRange] = useState<null | SequenceWindow>(null);
  const [loadingMore, setLoadingMore] = useState<"earlier" | "later" | null>(
    null,
  );
  const [fetchingPage, setFetchingPage] = useState(false);

  const inspectionQuery = useQuery({
    queryFn: getSequenceInspection,
    queryKey: sequenceInspectionKey(sequenceKey),
    ...refreshQueryOptions(refreshSettings.intervalMs),
    // Poll only while the sequence can change on its own.
    refetchInterval: (query) =>
      refreshSettings.intervalMs > 0 && sequenceCanChange(query.state.data)
        ? refreshSettings.intervalMs
        : false,
  });
  const inspection = inspectionQuery.data;

  // Pick the starting range once the first inspection arrives. Later
  // refreshes keep the range the operator is looking at.
  if (inspection && !range) {
    setRange(initialSequenceWindow(inspection, selectedJobId));
  }

  const jobsQuery = useQuery({
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<SequenceJobListPage> => {
      if (!range) throw new Error("No range of jobs selected.");
      return listSequenceJobs(sequenceKey, range.cursor, range.limit, signal);
    },
    // Without a range the query is disabled, and its key is never fetched.
    queryKey: sequenceJobListKey(
      sequenceKey,
      range?.cursor ?? { newest: true },
      range?.limit ?? 0,
    ),
  });
  const jobs = jobsQuery.data?.jobs ?? [];
  // A button stays busy while its page loads: first the earlier page itself,
  // then the wider range that replaces the shown jobs.
  const busy = (direction: "earlier" | "later") =>
    loadingMore === direction && (fetchingPage || jobsQuery.isPlaceholderData);

  // The list refreshes along with the inspection: whenever a poll or an action
  // sees the sequence change (like a job finishing), reload the visible range.
  const fingerprint = inspection ? inspectionFingerprint(inspection) : null;
  const lastFingerprint = useRef(fingerprint);
  useEffect(() => {
    if (fingerprint === lastFingerprint.current) return;
    const changed = lastFingerprint.current !== null;
    lastFingerprint.current = fingerprint;
    if (changed) {
      void queryClient.invalidateQueries({
        queryKey: [...sequenceKeyPrefix(sequenceKey), "jobs"],
      });
    }
  }, [fingerprint, queryClient, sequenceKey]);

  // Showing later jobs raises the range's limit, and slides it forward once
  // it's at the maximum. The newest jobs have nothing later to show.
  const showLater = () => {
    if (!range || !("afterId" in range.cursor)) return;
    setLoadingMore("later");
    if (range.limit + SEQUENCE_PAGE_SIZE <= SEQUENCE_WINDOW_MAX) {
      setRange({ ...range, limit: range.limit + SEQUENCE_PAGE_SIZE });
      return;
    }
    const dropped = jobs[SEQUENCE_PAGE_SIZE - 1];
    if (dropped) {
      setRange({ cursor: { afterId: dropped.id }, limit: range.limit });
    }
  };

  // Showing earlier jobs loads the page before the shown jobs to find where
  // the wider range starts. Past the maximum, the latest jobs drop from view.
  const showEarlier = async () => {
    const first = jobs[0];
    if (!first || !range) return;
    setLoadingMore("earlier");
    setFetchingPage(true);
    try {
      const cursor = { beforeId: first.id };
      const page = await queryClient.fetchQuery({
        queryFn: ({ signal }) =>
          listSequenceJobs(sequenceKey, cursor, SEQUENCE_PAGE_SIZE, signal),
        queryKey: sequenceJobListKey(sequenceKey, cursor, SEQUENCE_PAGE_SIZE),
      });
      const start = page.jobs[0]?.id ?? first.id;
      setRange({
        cursor: { afterId: start - 1n },
        limit: Math.min(SEQUENCE_WINDOW_MAX, jobs.length + page.jobs.length),
      });
    } catch (error) {
      toastError({
        message: "Couldn't load earlier jobs",
        subtext: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setFetchingPage(false);
    }
  };

  const jumpToJob = (jobId: bigint) =>
    setRange({ cursor: { afterId: jobId - 1n }, limit: SEQUENCE_PAGE_SIZE });

  // Retrying or deleting a halting job changes the whole sequence, so cached
  // job pages for any job in it are stale too.
  const refreshSequence = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: sequenceKeyPrefix(sequenceKey),
      }),
      queryClient.invalidateQueries({ queryKey: getJobKeyPrefix }),
      queryClient.invalidateQueries({ queryKey: jobSequenceKeyPrefix }),
    ]);

  const retryMutation = useRetryJobs({
    onSuccess: refreshSequence,
    successMessage: "Job enqueued for retry",
  });

  const deleteMutation = useMutation<void, Error, bigint>({
    mutationFn: async (jobId, context) => deleteJobs({ ids: [jobId] }, context),
    onError: (error) => {
      toastError({ message: "Job delete failed", subtext: error.message });
    },
    onSuccess: (_data, jobId) => {
      toastSuccess({ duration: 2000, message: "Job deleted" });
      queryClient.removeQueries({ queryKey: getJobKey(jobId) });
      return refreshSequence();
    },
  });

  return (
    <SequenceDetail
      hasEarlier={jobsQuery.data?.hasEarlier ?? false}
      hasLater={jobsQuery.data?.hasLater ?? false}
      inspection={inspection}
      inspectionError={inspectionQuery.isError}
      jobs={jobs}
      jobsError={jobsQuery.isError}
      jobsLoading={!range || jobsQuery.isPending}
      onJumpToJob={jumpToJob}
      onRemoveHalt={(jobId, action) => {
        if (action === "retry") {
          retryMutation.mutate([jobId]);
        } else {
          deleteMutation.mutate(jobId);
        }
      }}
      onShowEarlier={() => void showEarlier()}
      onShowLater={showLater}
      selectedJobId={selectedJobId}
      sequenceKey={sequenceKey}
      showingEarlier={busy("earlier")}
      showingLater={busy("later")}
    />
  );
}

const inspectionFingerprint = (inspection: SequenceInspection) =>
  JSON.stringify([
    inspection.haltedBy?.id.toString(),
    inspection.head?.id.toString(),
    inspection.blockers.map((job) => `${job.id}:${job.state}`),
    inspection.pendingCount,
  ]);

import { Badge, type BadgeColor } from "@components/Badge";
import CopyableHeadingText from "@components/CopyableHeadingText";
import HaltingJobDeleteDialog from "@components/HaltingJobDeleteDialog";
import {
  SequenceJobLink,
  SequenceJobRefState,
  SequenceJobState,
} from "@components/JobSequenceStatus";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { TaskStateIcon } from "@components/TaskStateIcon";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatPendingCount,
  isActiveState,
  type SequenceInspection,
  type SequenceJob,
  type SequenceJobListItem,
} from "@services/sequences";
import { JobState } from "@services/types";
import { Link } from "@tanstack/react-router";
import { compactJSONText } from "@utils/jsonText";
import clsx from "clsx";
import { type ReactNode, useMemo, useState } from "react";

export type SequenceDetailProps = {
  hasEarlier: boolean;
  hasLater: boolean;
  inspection?: SequenceInspection;
  inspectionError?: boolean;
  jobs: SequenceJobListItem[];
  jobsError?: boolean;
  jobsLoading?: boolean;
  // Loads the job's surroundings when it isn't in the loaded range.
  onJumpToJob?: (jobId: bigint) => void;
  onRemoveHalt: (jobId: bigint, action: "delete" | "retry") => void;
  onShowEarlier: () => void;
  onShowLater: () => void;
  // The job the operator came from, outlined in the list.
  selectedJobId?: bigint;
  sequenceKey: string;
  showingEarlier?: boolean;
  showingLater?: boolean;
};

const muted = "text-slate-500 dark:text-slate-400";

export default function SequenceDetail({
  hasEarlier,
  hasLater,
  inspection,
  inspectionError,
  jobs,
  jobsError,
  jobsLoading,
  onJumpToJob,
  onRemoveHalt,
  onShowEarlier,
  onShowLater,
  selectedJobId,
  sequenceKey,
  showingEarlier,
  showingLater,
}: SequenceDetailProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const haltedBy = inspection?.haltedBy;
  const head = inspection?.head;
  // IDs are monospace, so `ch` fits the longest one plus its "#".
  const idWidth = `${Math.max(0, ...jobs.map((job) => job.id.toString().length)) + 1}ch`;
  const selectedLoaded =
    selectedJobId === undefined || jobs.some((job) => job.id === selectedJobId);

  return (
    <>
      <TopNavTitleOnly title="Sequence" />
      <main>
        <header className="mb-8 bg-gray-300/10 p-4 sm:px-6 lg:px-8 dark:bg-gray-700/10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 truncate text-2xl leading-7 font-semibold text-slate-900 dark:text-white">
              {sequenceTitle(jobs, inspection)}
            </h1>
            <span aria-live="polite" className="text-base leading-6">
              {inspectionError ? (
                <span className={muted}>Status unavailable</span>
              ) : inspection ? (
                <SequenceStatusBadge inspection={inspection} />
              ) : null}
            </span>
          </div>
          {/* The key is a hash, useful only to copy, so it's shortened like
              a commit SHA. */}
          <p className="mt-2 flex items-center gap-x-1 text-base leading-6 text-slate-600 dark:text-slate-400">
            Key:
            <span className="inline-flex max-w-[18ch] font-mono">
              <CopyableHeadingText
                label="sequence key"
                text={sequenceKey}
                textClassName="font-normal text-slate-600 dark:text-slate-400"
              />
            </span>
          </p>
        </header>

        <div className="px-4 pb-16 sm:px-6 lg:px-8">
          {inspection && !inspectionError && (
            <SequenceFacts inspection={inspection} />
          )}

          <div className="mt-8 mb-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Jobs
            </h2>
            <p className={clsx("text-sm", muted)}>
              Jobs in a sequence run one at a time, in ID order.
            </p>
          </div>

          {!selectedLoaded && selectedJobId !== undefined && !jobsLoading && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
              Job <span className="font-mono">#{selectedJobId.toString()}</span>{" "}
              isn&apos;t in the jobs shown below.{" "}
              {onJumpToJob && (
                <button
                  className="cursor-pointer font-medium underline"
                  onClick={() => onJumpToJob(selectedJobId)}
                  type="button"
                >
                  Show it
                </button>
              )}
            </p>
          )}

          <ol className="divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {hasEarlier && (
              <PagingRow
                Icon={ArrowUpIcon}
                loading={showingEarlier}
                onClick={onShowEarlier}
                text="Show earlier jobs"
              />
            )}
            {jobs.map((job) => (
              <SequenceJobRow
                halting={job.id === haltedBy?.id}
                head={head}
                idWidth={idWidth}
                inspection={inspection}
                job={job}
                key={job.id.toString()}
                onDelete={() => setDeleteOpen(true)}
                onRetry={() => onRemoveHalt(job.id, "retry")}
                selected={job.id === selectedJobId}
              />
            ))}
            {jobs.length === 0 && (
              <li className={clsx("py-6 text-center text-sm", muted)}>
                {jobsError
                  ? "Couldn't load this sequence's jobs."
                  : jobsLoading
                    ? "Loading jobs…"
                    : "No jobs in this sequence."}
              </li>
            )}
            {hasLater && (
              <PagingRow
                Icon={ArrowDownIcon}
                loading={showingLater}
                onClick={onShowLater}
                text="Show later jobs"
              />
            )}
          </ol>
        </div>
      </main>

      {haltedBy && head && inspection?.pendingCount && (
        <HaltingJobDeleteDialog
          head={head}
          jobId={haltedBy.id}
          onClose={() => setDeleteOpen(false)}
          onDelete={() => {
            setDeleteOpen(false);
            onRemoveHalt(haltedBy.id, "delete");
          }}
          onRetry={() => {
            setDeleteOpen(false);
            onRemoveHalt(haltedBy.id, "retry");
          }}
          open={deleteOpen}
          pendingCount={inspection.pendingCount}
        />
      )}
    </>
  );
}

// sequenceTitle names a sequence by the kind of its jobs, like the job page.
// The key is a hash of options that aren't stored, so the kinds seen in the
// loaded jobs are all that can be shown reliably. Mixed kinds, or none loaded
// yet, fall back to a generic title.
const sequenceTitle = (
  jobs: { kind: string }[],
  inspection?: SequenceInspection,
): string => {
  const kinds = new Set(jobs.map((job) => job.kind));
  for (const job of [
    inspection?.haltedBy,
    inspection?.head,
    ...(inspection?.blockers ?? []),
  ]) {
    if (job) kinds.add(job.kind);
  }
  const [only] = kinds;
  return kinds.size === 1 && only ? only : "Sequence";
};

// sequenceStatus names the state of the whole sequence: halted by a job,
// waiting on an active job, about to run its next job, or idle.
const sequenceStatus = (
  inspection: SequenceInspection,
): { color: BadgeColor; label: string } => {
  const active = inspection.blockers.some((job) => isActiveState(job.state));
  if (inspection.haltedBy) return { color: "red", label: "Halted" };
  if (inspection.head && active) return { color: "amber", label: "Waiting" };
  if (inspection.head) return { color: "zinc", label: "Up next" };
  if (active) return { color: "blue", label: "Active" };
  return { color: "zinc", label: "Idle" };
};

function SequenceStatusBadge({
  inspection,
}: {
  inspection: SequenceInspection;
}) {
  const { color, label } = sequenceStatus(inspection);
  return <Badge color={color}>{label}</Badge>;
}

const factClassName =
  "border-t border-slate-100 py-4 pr-4 sm:col-span-4 dark:border-slate-800";

// SequenceFacts is the sequence's details grid: the job holding it back, if
// any, its next pending job, and how many jobs are pending.
export function SequenceFacts({
  inspection,
}: {
  inspection: SequenceInspection;
}) {
  const { haltedBy, head, pendingCount } = inspection;
  const active = inspection.blockers.find((job) => isActiveState(job.state));

  let blocker: ReactNode = null;
  if (haltedBy) {
    blocker = (
      <Fact
        className="col-span-12"
        hint="Retry or delete it to resume."
        term="Halted by"
      >
        <SequenceJobRefState job={haltedBy} />
      </Fact>
    );
  } else if (active) {
    blocker = (
      <Fact className="col-span-12" term={head ? "Waiting on" : "Active job"}>
        <SequenceJobRefState job={active} />
      </Fact>
    );
  }

  return (
    <dl className="grid grid-cols-12">
      {blocker}
      <Fact term="Next pending">
        {head ? <SequenceJobLink job={head} /> : "–"}
      </Fact>
      <Fact term="Pending">
        {pendingCount && pendingCount.count > 0
          ? `${formatPendingCount(pendingCount)} ${pendingCount.count === 1 && !pendingCount.more ? "job" : "jobs"}`
          : "–"}
      </Fact>
    </dl>
  );
}

function Fact({
  children,
  className = "col-span-6",
  hint,
  term,
}: {
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
  term: string;
}) {
  return (
    <div className={clsx(className, factClassName)}>
      <dt className="text-sm leading-6 font-medium text-slate-900 dark:text-slate-100">
        {term}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-slate-700 sm:mt-2 dark:text-slate-300">
        {children}
        {hint && (
          <span className={clsx("mt-1 block text-xs leading-5", muted)}>
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

function PagingRow({
  Icon,
  loading,
  onClick,
  text,
}: {
  Icon: typeof ArrowUpIcon;
  loading?: boolean;
  onClick: () => void;
  text: string;
}) {
  return (
    <li>
      <button
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-blue-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:text-blue-400 dark:hover:bg-white/5"
        disabled={loading}
        onClick={onClick}
        type="button"
      >
        <Icon aria-hidden="true" className="size-4" />
        {loading ? "Loading…" : text}
      </button>
    </li>
  );
}

// rowTime is the moment a row's time column describes, like the Jobs list:
// when a finished job finalized, when an active job runs next or started, and
// when a pending job was added.
const rowTime = (job: SequenceJobListItem): Date => {
  switch (job.state) {
    case JobState.Available:
    case JobState.Retryable:
    case JobState.Scheduled:
      return job.scheduledAt;
    case JobState.Cancelled:
    case JobState.Completed:
    case JobState.Discarded:
      return job.finalizedAt ?? job.createdAt;
    case JobState.Pending:
      return job.createdAt;
    case JobState.Running:
      return job.attemptedAt ?? job.scheduledAt;
  }
};

// RowActionButton is a compact button for actions inside a list row. Page-level
// buttons grow at mobile widths, which would crowd a row.
function RowActionButton({
  Icon,
  onClick,
  text,
}: {
  Icon: typeof TrashIcon;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      className="relative inline-flex items-center gap-x-1 bg-white px-2.5 py-1 text-xs/5 font-semibold text-slate-900 inset-ring inset-ring-slate-300 not-first:-ml-px first:rounded-l-md last:rounded-r-md hover:bg-slate-50 focus:z-10 dark:bg-white/5 dark:text-white dark:inset-ring-white/15 dark:hover:bg-white/10"
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {text}
    </button>
  );
}

function SequenceJobRow({
  halting,
  head,
  idWidth,
  inspection,
  job,
  onDelete,
  onRetry,
  selected,
}: {
  halting: boolean;
  head?: null | SequenceJob;
  // Fits the longest ID in the list, so kinds line up.
  idWidth: string;
  inspection?: SequenceInspection;
  job: SequenceJobListItem;
  onDelete: () => void;
  onRetry: () => void;
  selected: boolean;
}) {
  const id = job.id.toString();
  const blocking =
    isActiveState(job.state) &&
    !!head &&
    !!inspection?.blockers.some((blocker) => blocker.id === job.id);
  // What a job holding the sequence back did to it.
  const role = halting
    ? "halted the sequence"
    : blocking
      ? "blocking the sequence"
      : null;
  const args = useMemo(() => compactJSONText(job.argsRaw), [job.argsRaw]);

  return (
    <li
      aria-current={selected ? "true" : undefined}
      className={clsx(
        "-mx-2 rounded-md px-2 py-2.5 sm:-mx-3 sm:px-3",
        halting && "bg-red-50 dark:bg-red-950/30",
        selected && "ring-2 ring-blue-400 ring-inset dark:ring-blue-500/70",
      )}
      id={`job-${id}`}
    >
      <div className="flex items-center gap-x-3">
        <TaskStateIcon className="size-4 flex-none" jobState={job.state} />
        <Link
          className="flex-none font-mono text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          params={{ jobId: job.id }}
          style={{ minWidth: idWidth }}
          to="/jobs/$jobId"
        >
          #{id}
        </Link>
        <span className="min-w-0 grow truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {job.kind}
        </span>
        <span className="flex-none text-right text-sm text-slate-700 tabular-nums dark:text-slate-300">
          <RelativeTimeFormatter addSuffix time={rowTime(job)} />
        </span>
      </div>
      {/* Args, like the Jobs list. Phones hide them. */}
      <p
        className="mt-1 hidden truncate pl-7 font-mono text-xs leading-5 text-slate-500 sm:block dark:text-slate-400"
        title={args}
      >
        {args}
      </p>
      {/* Only a job holding the sequence back gets a third line: what
          happened to it, and any actions to clear it. The state's icon is
          already at the start of the row. */}
      {role && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-7 text-sm leading-6">
          <span>
            <SequenceJobState job={job} />
            <span className={muted}> · {role}</span>
          </span>
          {halting && (
            <span className="isolate inline-flex rounded-md shadow-xs">
              <RowActionButton
                Icon={ArrowUturnLeftIcon}
                onClick={onRetry}
                text="Retry"
              />
              <RowActionButton
                Icon={TrashIcon}
                onClick={onDelete}
                text="Delete"
              />
            </span>
          )}
        </div>
      )}
    </li>
  );
}

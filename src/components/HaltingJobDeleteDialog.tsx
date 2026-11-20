import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  formatPendingCount,
  type SequenceJob,
  type SequencePendingCount,
} from "@services/sequences";
import { type ReactNode } from "react";

export type HaltingJobDeleteDialogProps = {
  // An earlier job that also halts the sequence, if any. Deleting this job
  // doesn't release the waiting jobs while it's there.
  earlierHalt?: null | SequenceJob;
  // The first pending job behind the halting job.
  head: SequenceJob;
  jobId: bigint;
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
  open: boolean;
  pendingCount: SequencePendingCount;
};

const pendingJobsPhrase = (count: SequencePendingCount) =>
  `${formatPendingCount(count)} pending ${count.count === 1 && !count.more ? "job" : "jobs"}`;

// HaltingJobDeleteDialog confirms deleting a cancelled or discarded job that's
// halting its sequence. Deleting it lets the jobs behind it run without it,
// which is rarely what an operator wants, so the dialog lays out both choices
// side by side and offers Retry, which keeps the sequence in order.
export default function HaltingJobDeleteDialog({
  earlierHalt,
  head,
  jobId,
  onClose,
  onDelete,
  onRetry,
  open,
  pendingCount,
}: HaltingJobDeleteDialogProps) {
  if (!open) return null;

  const id = jobId.toString();
  const waiting = pendingJobsPhrase(pendingCount);

  return (
    <Dialog className="relative z-[60]" onClose={onClose} open>
      <DialogBackdrop
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
        transition
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
          <DialogPanel
            className="relative w-full transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-xl data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10"
            transition
          >
            <div className="px-4 pt-5 pb-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="size-6 text-amber-600 dark:text-amber-400"
                  />
                </div>
                <div className="min-w-0">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-gray-900 dark:text-white"
                  >
                    Job <span className="font-mono">{id}</span> halted its
                    sequence
                  </DialogTitle>
                  <Description className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {waiting}
                    </span>{" "}
                    are waiting behind it, starting with{" "}
                    <span className="font-mono">#{head.id.toString()}</span>.
                  </Description>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Choice
                  action={
                    <button
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 dark:bg-blue-500 dark:shadow-none dark:hover:bg-blue-400"
                      data-autofocus
                      onClick={onRetry}
                      type="button"
                    >
                      <ArrowUturnLeftIcon
                        aria-hidden="true"
                        className="size-4"
                      />
                      Retry instead
                    </button>
                  }
                  badge="Keeps order"
                  badgeClassName="bg-green-500/15 text-green-700 dark:text-green-400"
                  title={`Retry #${id}`}
                >
                  It runs again first, then the jobs behind it run in order.
                </Choice>
                <Choice
                  action={
                    <button
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-xs inset-ring inset-ring-red-300 hover:bg-red-50 dark:bg-white/5 dark:text-red-400 dark:shadow-none dark:inset-ring-red-500/40 dark:hover:bg-red-500/10"
                      onClick={onDelete}
                      type="button"
                    >
                      <TrashIcon aria-hidden="true" className="size-4" />
                      Delete anyway
                    </button>
                  }
                  badge="Can't be undone"
                  badgeClassName="bg-red-500/15 text-red-700 dark:text-red-400"
                  title={`Delete #${id}`}
                >
                  {earlierHalt ? (
                    <>
                      The jobs behind it keep waiting on earlier job{" "}
                      <span className="font-mono">
                        #{earlierHalt.id.toString()}
                      </span>
                      , then run without this one.
                    </>
                  ) : (
                    <>The {waiting} start running right away, skipping it.</>
                  )}
                </Choice>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:justify-end sm:px-6 dark:bg-gray-700/25">
              <button
                className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function Choice({
  action,
  badge,
  badgeClassName,
  children,
  title,
}: {
  action: ReactNode;
  badge: string;
  badgeClassName: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
        <span
          className={`rounded-md px-1.5 py-0.5 text-xs/5 font-medium ${badgeClassName}`}
        >
          {badge}
        </span>
      </div>
      <p className="flex-1 text-sm text-gray-600 dark:text-gray-400">
        {children}
      </p>
      {action}
    </section>
  );
}

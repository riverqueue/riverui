import { Queue } from "@services/queues";
import { PauseCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";

type QueueListProps = {
  loading: boolean;
  pauseQueue: (name: string) => void;
  queues: Queue[];
  resumeQueue: (name: string) => void;
};

const QueueList = ({
  loading,
  pauseQueue,
  queues,
  resumeQueue,
}: QueueListProps) => {
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="size-full">
      <TopNavTitleOnly title="Queues" />

      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 mt-8 sm:-mx-0">
          <table className="min-w-full table-fixed divide-y divide-slate-300 dark:divide-slate-700">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="py-2.5 pr-3 pl-4 text-left text-sm font-semibold text-slate-900 sm:pl-0 dark:text-slate-100"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 md:table-cell dark:text-slate-100"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
                >
                  Available
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
                >
                  Running
                </th>
                <th
                  scope="col"
                  className="table-cell w-20 min-w-20 px-3 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="relative w-12 py-2.5 pr-4 pl-3 sm:pr-0"
                >
                  <span className="sr-only">Controls</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {queues.map((queue) => (
                <tr key={queue.name}>
                  <td className="w-full max-w-0 py-2 pr-3 pl-4 text-sm font-medium text-slate-700 sm:w-auto sm:max-w-none sm:pl-0 dark:text-slate-300">
                    <span className="font-mono font-semibold dark:text-slate-100">
                      {queue.name}
                    </span>
                    <dl className="font-normal md:hidden">
                      <dt className="sr-only sm:hidden">Available</dt>
                      <dd className="mt-1 truncate sm:hidden">
                        {queue.countAvailable} available
                      </dd>
                      <dt className="sr-only sm:hidden">Running</dt>
                      <dd className="mt-1 truncate sm:hidden">
                        {queue.countRunning} running
                      </dd>
                      <dt className="sr-only">Created</dt>
                      <dd className="mt-1 truncate">
                        <RelativeTimeFormatter
                          time={queue.createdAt}
                          addSuffix
                          includeSeconds
                        />
                      </dd>
                    </dl>
                  </td>
                  <td className="hidden px-3 py-2 text-right text-sm text-slate-500 md:table-cell dark:text-slate-300">
                    <RelativeTimeFormatter
                      time={queue.createdAt}
                      addSuffix
                      includeSeconds
                    />
                  </td>
                  <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
                    {queue.countAvailable}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
                    {queue.countRunning}
                  </td>
                  <td className="table-cell w-20 min-w-20 px-3 py-2 text-sm text-slate-500 dark:text-slate-300">
                    {queue.pausedAt ? "Paused" : "Active"}
                  </td>
                  <td className="w-12 py-2 pr-4 pl-3 text-right text-sm font-medium sm:pr-0">
                    <button
                      className="rounded-md bg-white px-2 py-1 text-sm font-semibold text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset hover:bg-slate-50 dark:bg-white/10 dark:text-white dark:ring-slate-700 dark:hover:bg-white/20"
                      onClick={
                        queue.pausedAt
                          ? () => resumeQueue(queue.name)
                          : () => pauseQueue(queue.name)
                      }
                      title={queue.pausedAt ? "Resume" : "Pause"}
                      type="button"
                    >
                      {queue.pausedAt ? (
                        <PlayCircleIcon className="size-5" aria-hidden="true" />
                      ) : (
                        <PauseCircleIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      )}
                      <span className="sr-only">
                        {queue.pausedAt ? "Resume" : "Pause"}, {queue.name}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QueueList;

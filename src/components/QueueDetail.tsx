import { Badge } from "@components/Badge";
import { Button } from "@components/Button";
import Logo from "@components/Logo";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import TagInput from "@components/TagInput";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import { useFeatures } from "@contexts/Features.hook";
import { Switch } from "@headlessui/react";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { PauseCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import { Features } from "@services/features";
import { type Producer } from "@services/producers";
import {
  type ConcurrencyConfig,
  type PartitionConfig,
  type Queue,
} from "@services/queues";
import clsx from "clsx";
import { type ReactElement, useMemo, useState } from "react";

type QueueDetailProps = {
  loading: boolean;
  name: string;
  pauseQueue: (name: string) => void;
  producers?: Producer[];
  queue?: Queue;
  resumeQueue: (name: string) => void;
  updateQueueConcurrency: (
    name: string,
    concurrency: ConcurrencyConfig | null,
  ) => void;
};

const QueueDetail = ({
  loading,
  name,
  pauseQueue,
  producers,
  queue,
  resumeQueue,
  updateQueueConcurrency,
}: QueueDetailProps) => {
  const { features } = useFeatures();

  return (
    <div className="size-full">
      <TopNavTitleOnly
        title={
          <>
            Queue: <span className="font-mono">{name}</span>
          </>
        }
      />

      <div className="mx-auto p-4 sm:px-6 lg:px-8">
        {loading ? (
          <h4>Loading…</h4>
        ) : !queue ? (
          <p>Queue not found.</p>
        ) : (
          <div className="text-black dark:text-white">
            <QueueStatusCard
              features={features}
              pauseQueue={pauseQueue}
              producers={producers}
              queue={queue}
              resumeQueue={resumeQueue}
            />

            {features.hasProducerTable && features.producerQueries ? (
              <>
                <ConcurrencySettings
                  producers={producers}
                  queue={queue}
                  updateQueueConcurrency={updateQueueConcurrency}
                />

                {producers && producers.length > 0 && (
                  <ClientsTable producers={producers} />
                )}
              </>
            ) : (
              <ConcurrencyLimitsDisabled />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueDetail;

type QueueStatusCardProps = {
  features: Features;
  pauseQueue: (name: string) => void;
  producers?: Producer[];
  queue: Queue;
  resumeQueue: (name: string) => void;
};

const PauseResumeButton = ({
  isPaused,
  onClick,
}: {
  isPaused: boolean;
  onClick: () => void;
}): ReactElement => (
  <Button
    className="w-28"
    onClick={onClick}
    outline
    title={isPaused ? "Resume" : "Pause"}
  >
    {isPaused ? (
      <div className="flex w-full items-center justify-start">
        <PlayCircleIcon aria-hidden="true" className="mr-2 h-5 w-5" />
        Resume
      </div>
    ) : (
      <div className="flex w-full items-center justify-start">
        <PauseCircleIcon aria-hidden="true" className="mr-2 h-5 w-5" />
        Pause
      </div>
    )}
  </Button>
);

const QueueStatusCard = ({
  features,
  pauseQueue,
  producers,
  queue,
  resumeQueue,
}: QueueStatusCardProps) => {
  const totalRunning =
    features.hasProducerTable && features.producerQueries
      ? producers?.reduce((acc, producer) => acc + producer.running, 0)
      : queue.countRunning;

  return (
    <div className="border-1 border-slate-200 sm:rounded-lg dark:border-slate-800">
      <div className="px-6 py-6">
        <div className="flex flex-wrap gap-y-6 sm:flex-nowrap sm:items-center sm:justify-between sm:gap-x-8">
          <div className="order-1 w-full sm:order-1 sm:w-auto">
            <div className="flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div>
                {queue.pausedAt ? (
                  <Badge color="yellow">Paused</Badge>
                ) : (
                  <Badge color="green">Active</Badge>
                )}
              </div>
              <span>
                Created{" "}
                <RelativeTimeFormatter addSuffix time={queue.createdAt} />
              </span>
            </div>
          </div>

          <div className="order-2 sm:order-2 sm:flex sm:flex-grow sm:justify-center">
            <div className="flex gap-12">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Available
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  {queue.countAvailable}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Running
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  {totalRunning}
                </dd>
              </div>
            </div>
          </div>

          <div className="order-3 ml-auto flex items-center sm:order-3 sm:ml-0">
            <PauseResumeButton
              isPaused={!!queue.pausedAt}
              onClick={
                queue.pausedAt
                  ? () => resumeQueue(queue.name)
                  : () => pauseQueue(queue.name)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

type ConcurrencySettingsProps = {
  producers?: Producer[];
  queue: Queue;
  updateQueueConcurrency: (
    name: string,
    concurrency: ConcurrencyConfig | null,
  ) => void;
};

const ConcurrencySettings = ({
  producers,
  queue,
  updateQueueConcurrency,
}: ConcurrencySettingsProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  type ConcurrencyForm = {
    enabled: boolean;
    globalLimit: number;
    localLimit: number;
    partitionArgs: string[];
    partitionByArgs: boolean;
    partitionByKind: boolean;
  };

  const producerConcurrencyStatus = useMemo(() => {
    if (!producers || producers.length === 0)
      return { config: null, consistent: true };

    // Filter out paused producers
    const activeProducers = producers.filter((p) => !p.pausedAt);

    // If there are no active producers, return null config but consider it consistent
    if (activeProducers.length === 0) return { config: null, consistent: true };

    const firstProducer = activeProducers[0];
    const allSame = activeProducers.every((p) => {
      if (!p.concurrency && !firstProducer.concurrency) return true;
      if (!p.concurrency || !firstProducer.concurrency) return false;

      const basicSettingsMatch =
        p.concurrency.global_limit === firstProducer.concurrency.global_limit &&
        p.concurrency.local_limit === firstProducer.concurrency.local_limit;

      if (!p.concurrency.partition && !firstProducer.concurrency.partition) {
        return basicSettingsMatch;
      }

      if (!p.concurrency.partition || !firstProducer.concurrency.partition) {
        return false;
      }

      const byKindMatch =
        p.concurrency.partition.by_kind ===
        firstProducer.concurrency.partition.by_kind;

      const byArgsMatch = (() => {
        const pArgs = p.concurrency.partition.by_args;
        const firstArgs = firstProducer.concurrency.partition.by_args;

        if (!pArgs && !firstArgs) return true;
        if (!pArgs || !firstArgs) return false;

        return (
          pArgs.length === firstArgs.length &&
          pArgs.every((arg, i) => arg === firstArgs[i])
        );
      })();

      return basicSettingsMatch && byKindMatch && byArgsMatch;
    });

    return {
      config: allSame ? firstProducer.concurrency : null,
      consistent: allSame,
    };
  }, [producers]);

  const derivedForm: ConcurrencyForm = useMemo(() => {
    const config =
      queue.concurrency ||
      (producerConcurrencyStatus.consistent
        ? producerConcurrencyStatus.config
        : null);

    const byArgs = config?.partition?.by_args;

    return {
      enabled: Boolean(queue.concurrency),
      globalLimit: config?.global_limit ?? 0,
      localLimit: config?.local_limit ?? 0,
      partitionArgs: Array.isArray(byArgs) ? byArgs : [],
      partitionByArgs: Boolean(config?.partition?.by_args),
      partitionByKind: Boolean(config?.partition?.by_kind),
    };
  }, [
    producerConcurrencyStatus.config,
    producerConcurrencyStatus.consistent,
    queue.concurrency,
  ]);

  const [initialForm, setInitialForm] = useState<ConcurrencyForm>(derivedForm);
  const [concurrencyForm, setConcurrencyForm] =
    useState<ConcurrencyForm>(derivedForm);

  const activeForm = isEditMode ? concurrencyForm : derivedForm;
  const activeInitialForm = isEditMode ? initialForm : derivedForm;

  // Check if form is dirty (has changes)
  const isDirty = useMemo(() => {
    const partitionArgsChanged = () => {
      if (
        activeForm.partitionArgs.length !==
        activeInitialForm.partitionArgs.length
      ) {
        return true;
      }
      // Compare arrays
      return activeForm.partitionArgs.some(
        (arg, index) => arg !== activeInitialForm.partitionArgs[index],
      );
    };

    return (
      activeForm.enabled !== activeInitialForm.enabled ||
      activeForm.globalLimit !== activeInitialForm.globalLimit ||
      activeForm.localLimit !== activeInitialForm.localLimit ||
      activeForm.partitionByArgs !== activeInitialForm.partitionByArgs ||
      activeForm.partitionByKind !== activeInitialForm.partitionByKind ||
      (activeForm.partitionByArgs && partitionArgsChanged())
    );
  }, [activeForm, activeInitialForm]);

  // Toggle edit mode when enabled is switched
  const handleEnabledToggle = (enabled: boolean) => {
    if (!isEditMode) {
      setIsEditMode(true);
      setConcurrencyForm(derivedForm);
      setInitialForm(derivedForm);
    }
    setConcurrencyForm((prev) => ({ ...prev, enabled }));
  };

  // For any form field change
  const handleFormChange = <K extends keyof typeof concurrencyForm>(
    key: K,
    value: (typeof concurrencyForm)[K],
  ) => {
    // Enter edit mode if we're changing values when concurrency is already overridden
    if (!isEditMode && activeForm.enabled) {
      setIsEditMode(true);
      setConcurrencyForm(derivedForm);
      setInitialForm(derivedForm);
    }
    setConcurrencyForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveConcurrency = () => {
    if (!queue) return;

    let newConcurrency = null;

    if (activeForm.enabled) {
      const partition: PartitionConfig = {
        by_args: activeForm.partitionByArgs
          ? activeForm.partitionArgs.length > 0
            ? activeForm.partitionArgs
            : []
          : null,
        by_kind: activeForm.partitionByKind ? true : null,
      };

      newConcurrency = {
        global_limit: activeForm.globalLimit,
        local_limit: activeForm.localLimit,
        partition,
      };
    }

    updateQueueConcurrency(queue.name, newConcurrency);
    setIsEditMode(false);
    setInitialForm(activeForm);
  };

  const cancelEdit = () => {
    setConcurrencyForm(activeInitialForm);
    setIsEditMode(false);
  };

  const isFormDisabled = !activeForm.enabled;

  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">
            Concurrency
          </h3>

          {!producerConcurrencyStatus.consistent && (
            <div className="text-sm text-yellow-600 dark:text-yellow-400">
              Clients have different concurrency settings
            </div>
          )}
        </div>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm/6 text-gray-600 dark:text-gray-400">
            Control how many jobs can run simultaneously in this queue.
          </p>
          <a
            className="inline-flex items-center text-sm font-medium text-brand-primary hover:text-brand-primary/80"
            href="https://riverqueue.com/docs/pro/concurrency-limits"
            rel="noopener noreferrer"
            target="_blank"
          >
            <BookOpenIcon aria-hidden="true" className="mr-1.5 size-4" />
            View docs
          </a>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center">
          <Switch
            checked={concurrencyForm.enabled}
            className={clsx(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:outline-none",
              concurrencyForm.enabled
                ? "bg-brand-primary"
                : "bg-gray-200 dark:bg-gray-600",
            )}
            id="override-concurrency"
            name="overrideConcurrency"
            onChange={handleEnabledToggle}
          >
            <span
              className={clsx(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                concurrencyForm.enabled ? "translate-x-6" : "translate-x-1",
              )}
            />
          </Switch>
          <label
            className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="override-concurrency"
          >
            Override concurrency settings
          </label>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column - Limits */}
          <div className={clsx("space-y-4", isFormDisabled && "opacity-50")}>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Limits
            </h4>
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  htmlFor="global-limit"
                >
                  Global Limit
                </label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isFormDisabled}
                  id="global-limit"
                  min="0"
                  name="globalLimit"
                  onChange={(e) =>
                    handleFormChange(
                      "globalLimit",
                      e.target.value ? parseInt(e.target.value) : 0,
                    )
                  }
                  placeholder="No limit"
                  type="number"
                  value={concurrencyForm.globalLimit}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  htmlFor="local-limit"
                >
                  Local Limit
                </label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isFormDisabled}
                  id="local-limit"
                  min="0"
                  name="localLimit"
                  onChange={(e) =>
                    handleFormChange(
                      "localLimit",
                      e.target.value ? parseInt(e.target.value) : 0,
                    )
                  }
                  placeholder="No limit"
                  type="number"
                  value={concurrencyForm.localLimit}
                />
              </div>
            </div>
          </div>

          {/* Right column - Partitioning */}
          <div className={clsx("space-y-4", isFormDisabled && "opacity-50")}>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Partitioning
            </h4>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={concurrencyForm.partitionByKind}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                      concurrencyForm.partitionByKind
                        ? "bg-brand-primary"
                        : "bg-gray-200 dark:bg-gray-600",
                    )}
                    disabled={isFormDisabled}
                    id="partition-by-kind"
                    name="partitionByKind"
                    onChange={(partitionByKind) =>
                      handleFormChange("partitionByKind", partitionByKind)
                    }
                  >
                    <span
                      className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        concurrencyForm.partitionByKind
                          ? "translate-x-6"
                          : "translate-x-1",
                      )}
                    />
                  </Switch>
                  <label
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="partition-by-kind"
                  >
                    Partition by kind
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={concurrencyForm.partitionByArgs}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                      concurrencyForm.partitionByArgs
                        ? "bg-brand-primary"
                        : "bg-gray-200 dark:bg-gray-600",
                    )}
                    disabled={isFormDisabled}
                    id="partition-by-args"
                    name="partitionByArgs"
                    onChange={(partitionByArgs) =>
                      handleFormChange("partitionByArgs", partitionByArgs)
                    }
                  >
                    <span
                      className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        concurrencyForm.partitionByArgs
                          ? "translate-x-6"
                          : "translate-x-1",
                      )}
                    />
                  </Switch>
                  <label
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="partition-by-args"
                  >
                    Partition by args
                  </label>
                </div>
              </div>

              <div className="md:mt-[18px]">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  htmlFor="partition-args"
                >
                  Argument keys
                </label>
                <TagInput
                  badgeColor="blue"
                  disabled={isFormDisabled || !concurrencyForm.partitionByArgs}
                  id="partition-args"
                  name="partitionArgs"
                  onChange={(tags) => handleFormChange("partitionArgs", tags)}
                  placeholder="Type JSON key and press Enter to add"
                  tags={concurrencyForm.partitionArgs}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to partition by all args (not recommended for high
                  cardinality).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-3">
          <Button disabled={!isDirty} onClick={cancelEdit} outline>
            Cancel
          </Button>
          <Button color="blue" disabled={!isDirty} onClick={saveConcurrency}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

const ClientsTable = ({ producers }: { producers: Producer[] }) => {
  return (
    <div className="my-8">
      <h3 className="mb-4 text-lg leading-6 font-medium text-gray-900 dark:text-white">
        Clients
      </h3>
      <div className="-mx-4 sm:-mx-0">
        <table className="min-w-full table-fixed divide-y divide-slate-300 dark:divide-slate-700">
          <thead>
            <tr>
              <th
                className="py-2.5 pr-3 pl-4 text-left text-sm font-semibold text-slate-900 sm:pl-0 dark:text-slate-100"
                scope="col"
              >
                ID
              </th>
              <th
                className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 md:table-cell dark:text-slate-100"
                scope="col"
              >
                Created
              </th>
              <th
                className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
                scope="col"
              >
                Running
              </th>
              <th
                className="hidden px-3 py-2.5 text-right text-sm font-semibold text-slate-900 sm:table-cell dark:text-slate-100"
                scope="col"
              >
                Max Workers
              </th>
              <th
                className="table-cell w-20 min-w-20 px-3 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
                scope="col"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {producers.map((producer) => (
              <tr key={producer.id}>
                <td className="w-full max-w-0 py-2 pr-3 pl-4 text-sm font-medium text-slate-700 sm:w-auto sm:max-w-none sm:pl-0 dark:text-slate-300">
                  <span className="block w-full truncate font-mono dark:text-slate-100">
                    {producer.clientId}
                  </span>
                  <dl className="font-normal md:hidden">
                    <dt className="sr-only sm:hidden">Running</dt>
                    <dd className="mt-1 truncate sm:hidden">
                      {producer.running} running
                    </dd>
                    <dt className="sr-only">Max Workers</dt>
                    <dd className="mt-1 truncate sm:hidden">
                      {producer.maxWorkers
                        ? `${producer.maxWorkers} max`
                        : "No limit"}
                    </dd>
                    <dt className="sr-only">Created</dt>
                    <dd className="mt-1 truncate">
                      {producer.createdAt && (
                        <RelativeTimeFormatter
                          addSuffix
                          includeSeconds
                          time={producer.createdAt}
                        />
                      )}
                    </dd>
                  </dl>
                </td>
                <td className="hidden px-3 py-2 text-right text-sm text-slate-500 md:table-cell dark:text-slate-300">
                  {producer.createdAt && (
                    <RelativeTimeFormatter
                      addSuffix
                      includeSeconds
                      time={producer.createdAt}
                    />
                  )}
                </td>
                <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
                  {producer.running}
                </td>
                <td className="hidden px-3 py-2 text-right text-sm text-slate-500 sm:table-cell dark:text-slate-300">
                  {producer.maxWorkers || "-"}
                </td>
                <td className="table-cell w-20 min-w-20 px-3 py-2 text-sm text-slate-500 dark:text-slate-300">
                  {producer.pausedAt ? (
                    <Badge color="yellow">Paused</Badge>
                  ) : (
                    <Badge color="green">Active</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ConcurrencyLimitsDisabled = () => {
  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">
            Concurrency
          </h3>
        </div>
        <p className="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
          Control how many jobs can run simultaneously in this queue.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="mx-4 mt-4 flex max-w-xl flex-col gap-6 overflow-hidden rounded-lg border border-slate-400/30 bg-white py-6 shadow-lg dark:bg-slate-800">
          <div className="flex flex-col px-4 sm:px-6">
            <div className="flex grow">
              <Logo className="mt-1 mr-3 h-6 w-auto text-brand-primary dark:text-white" />
              <Badge color="blue">Pro</Badge>
            </div>
            <h3 className="mt-4 text-lg leading-6 font-medium text-slate-900 dark:text-white">
              Concurrency limits
            </h3>
          </div>
          <div className="flex flex-col gap-4 px-4 sm:px-6">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Control how many jobs can run simultaneously across your entire
              application or within a single client with concurrency limits.
              Limits can be partitioned by job attributes to fine-tune
              performance and resource usage per customer, region, or job type.
            </p>
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Concurrency limits are included with River Pro. If you're already
              using Pro,{" "}
              <a
                className="text-brand-primary"
                href="https://riverqueue.com/docs/river-ui"
              >
                upgrade your deployment
              </a>{" "}
              to access Pro features in the UI.
            </p>
          </div>
          <div className="flex gap-4 px-4 sm:px-6">
            <a
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm text-white hover:bg-blue-500 hover:text-white"
              href="https://riverqueue.com/pro"
            >
              Learn more
            </a>
            <a
              className="flex items-center rounded-lg bg-transparent px-4 py-2 text-sm text-slate-800 hover:text-slate-600 dark:text-slate-200 dark:hover:text-slate-400"
              href="https://riverqueue.com/docs/pro/concurrency-limits"
            >
              Docs
              <ArrowRightIcon className="ml-2 size-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

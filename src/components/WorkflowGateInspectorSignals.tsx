import { Badge } from "@components/Badge";
import JSONView from "@components/JSONView";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  type WorkflowTaskSignal,
  type WorkflowTaskWait,
} from "@services/workflows";
import clsx from "clsx";
import { useState } from "react";

import {
  getLoadedSignalHistorySummary,
  getSignalEvidenceSummary,
} from "./WorkflowGateInspector.model";
import {
  type SignalHistorySurface,
  type SignalInspectorState,
} from "./WorkflowGateInspector.types";

export const ConditionSignalEvidenceDisclosure = ({
  onLoadMore,
  onToggle,
  open,
  phase,
  signal,
  signalListState,
  surface,
}: {
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggle: () => void;
  open: boolean;
  phase: WorkflowTaskWait["phase"];
  signal: WorkflowTaskWait["inputs"]["signals"][number];
  signalListState: SignalInspectorState;
  surface: SignalHistorySurface;
}) => {
  const scopeLabel =
    phase === "resolved" ? "Resolution evidence" : "Signal history";
  const signalSummary = getSignalEvidenceSummary(signal);

  return (
    <div className="mt-3 md:ml-[calc(5.75rem+0.75rem)]">
      <button
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm text-slate-900 hover:text-brand-primary dark:text-slate-100 dark:hover:text-blue-300"
        onClick={onToggle}
        type="button"
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-medium">{scopeLabel}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {signalSummary}
        </span>
      </button>

      {open ? (
        <SignalHistoryPanel
          emptyText={
            phase === "resolved"
              ? "No signals found in the final resolution evidence."
              : "No signals found in the current workflow attempt."
          }
          helperText={
            phase === "resolved"
              ? "Signals included when this wait resolved."
              : "Workflow signals declared by this wait."
          }
          onLoadMore={() => onLoadMore(surface)}
          signalListState={signalListState}
        />
      ) : null}
    </div>
  );
};

export const AllTaskSignalsPanel = ({
  onLoadMore,
  onToggle,
  open,
  signalListState,
}: {
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggle: () => void;
  open: boolean;
  signalListState: SignalInspectorState;
}) => {
  const signalSummary = getLoadedSignalHistorySummary(signalListState);

  return (
    <div className="space-y-3">
      <button
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm text-slate-900 hover:text-brand-primary dark:text-slate-100 dark:hover:text-blue-300"
        onClick={onToggle}
        type="button"
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-medium">All task signals</span>
        {signalSummary ? (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {signalSummary}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="ml-6">
          <SignalHistoryPanel
            emptyText="No declared signal history found for the current workflow attempt."
            helperText="Workflow signals declared by this wait."
            onLoadMore={() => onLoadMore({ kind: "all" })}
            signalListState={signalListState}
          />
        </div>
      ) : null}
    </div>
  );
};

const SignalHistoryPanel = ({
  emptyText,
  helperText,
  onLoadMore,
  signalListState,
}: {
  emptyText: string;
  helperText: string;
  onLoadMore: () => void;
  signalListState: SignalInspectorState;
}) => {
  const signalCount = signalListState.signals.length;

  return (
    <div className="mt-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">{helperText}</p>

      {signalListState.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {signalListState.error}
        </p>
      ) : null}

      {signalListState.isLoading ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Loading signal history…
        </p>
      ) : null}

      {!signalListState.isLoading && signalListState.signals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {emptyText}
        </p>
      ) : null}

      {signalCount > 0 ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/20">
          {signalListState.signals.map((signal) => (
            <SignalHistoryItem
              defaultOpen={signalListState.signals.length === 1}
              key={signal.id.toString()}
              signal={signal}
            />
          ))}
        </div>
      ) : null}

      {signalListState.hasMore ? (
        <button
          className="mt-3 text-sm font-medium text-brand-primary hover:text-blue-700 dark:hover:text-blue-300"
          onClick={onLoadMore}
          type="button"
        >
          {signalListState.isLoadingMore
            ? "Loading older signals…"
            : "Load older signals"}
        </button>
      ) : null}
    </div>
  );
};

const SignalHistoryItem = ({
  defaultOpen,
  signal,
}: {
  defaultOpen: boolean;
  signal: WorkflowTaskSignal;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group border-t border-slate-200 first:border-t-0 dark:border-slate-800"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 dark:text-slate-500"
        />
        <Badge color="light">#{signal.id.toString()}</Badge>
        <span className="font-mono break-all text-slate-900 dark:text-slate-100">
          {signal.key}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          workflow attempt {signal.attempt.toString()}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          <RelativeTimeFormatter addSuffix time={signal.createdAt} />
        </span>
      </summary>

      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
        <div className="grid gap-3 lg:grid-cols-2">
          <SignalPayloadPanel
            copyTitle="Signal payload"
            data={signal.payload}
            title="Payload"
          />
          <SignalPayloadPanel
            copyTitle="Signal source"
            data={signal.source}
            title="Source"
          />
        </div>
      </div>
    </details>
  );
};

const SignalPayloadPanel = ({
  copyTitle,
  data,
  title,
}: {
  copyTitle: string;
  data: unknown;
  title: string;
}) => {
  return (
    <div className="min-w-0 space-y-1">
      <h6 className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {title}
      </h6>
      <JSONView copyTitle={copyTitle} data={data} defaultExpandDepth={1} />
    </div>
  );
};

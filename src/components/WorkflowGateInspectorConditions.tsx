import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  InboxIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { type WorkflowTask, type WorkflowTaskWait } from "@services/workflows";
import clsx from "clsx";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import {
  conditionMatchesName,
  formatTimerAnchorWait,
  getConditionFocusKey,
  getConditionSignalStateKey,
  getConditionStateLabel,
  getConditionStateTone,
  getSignalSurfaceStateKey,
  getTimerDelayLabel,
  getWaitTermKindLabel,
  signalSurfaceForCondition,
} from "./WorkflowGateInspector.model";
import {
  emptySignalInspectorState,
  loadingSignalInspectorState,
  type SignalHistorySurface,
  type SignalInspectorState,
  type WaitFocusRequest,
  type WaitTermView,
} from "./WorkflowGateInspector.types";
import { ConditionSignalEvidenceDisclosure } from "./WorkflowGateInspectorSignals";

const INLINE_CEL_MAX_LENGTH = 72;

export const WaitTermViews = ({
  conditions,
  focusRequest,
  onLoadMore,
  onToggleConditionSignals,
  openSignalSurface,
  signalListStates,
  wait,
}: {
  conditions: WaitTermView[];
  focusRequest: undefined | WaitFocusRequest;
  onLoadMore: (surface: SignalHistorySurface) => void;
  onToggleConditionSignals: (surface: SignalHistorySurface) => void;
  openSignalSurface: SignalHistorySurface | undefined;
  signalListStates: Record<string, SignalInspectorState>;
  wait: WorkflowTaskWait;
}) => {
  const matchedConditions = conditions.filter((condition) => condition.matched);
  const latestConditionsRef = useRef(conditions);
  const conditionRowRefs = useRef(new Map<string, HTMLDivElement>());
  const handledFocusRequestIDRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    latestConditionsRef.current = conditions;
  }, [conditions]);

  useEffect(() => {
    if (!focusRequest) return;
    if (handledFocusRequestIDRef.current === focusRequest.requestID) return;

    const focusedCondition = latestConditionsRef.current.find((condition) =>
      conditionMatchesName(condition, focusRequest.conditionName),
    );
    if (!focusedCondition) return;

    const row = conditionRowRefs.current.get(
      getConditionFocusKey(focusedCondition),
    );
    row?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    row?.focus({ preventScroll: true });
    handledFocusRequestIDRef.current = focusRequest.requestID;
  }, [focusRequest]);

  const registerConditionRow = (
    condition: WaitTermView,
    node: HTMLDivElement | null,
  ) => {
    const key = getConditionFocusKey(condition);
    if (node) {
      conditionRowRefs.current.set(key, node);
      return;
    }

    conditionRowRefs.current.delete(key);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {matchedConditions.length.toString()} of {conditions.length.toString()}{" "}
        conditions satisfied
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="hidden gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[5.75rem_minmax(0,1fr)] dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          <span>Status</span>
          <span>Condition</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {conditions.map((condition) => {
            const conditionSignalState = condition.signal
              ? signalListStates[getConditionSignalStateKey(condition)]
              : undefined;
            const conditionSignalsOpen =
              condition.signal !== undefined &&
              openSignalSurface?.kind === "condition" &&
              getSignalSurfaceStateKey(openSignalSurface) ===
                getConditionSignalStateKey(condition);

            return (
              <ConditionRow
                condition={condition}
                focused={Boolean(
                  focusRequest &&
                  conditionMatchesName(condition, focusRequest.conditionName),
                )}
                key={`${condition.kind}:${condition.technicalName}`}
                onLoadMore={onLoadMore}
                onRegisterRow={registerConditionRow}
                onToggleConditionSignals={onToggleConditionSignals}
                openSignalSurface={openSignalSurface}
                signalListState={
                  conditionSignalState ??
                  (conditionSignalsOpen
                    ? loadingSignalInspectorState
                    : emptySignalInspectorState)
                }
                wait={wait}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ConditionRow = ({
  condition,
  focused,
  onLoadMore,
  onRegisterRow,
  onToggleConditionSignals,
  openSignalSurface,
  signalListState,
  wait,
}: {
  condition: WaitTermView;
  focused: boolean;
  onLoadMore: (surface: SignalHistorySurface) => void;
  onRegisterRow: (condition: WaitTermView, node: HTMLDivElement | null) => void;
  onToggleConditionSignals: (surface: SignalHistorySurface) => void;
  openSignalSurface: SignalHistorySurface | undefined;
  signalListState: SignalInspectorState;
  wait: WorkflowTaskWait;
}) => {
  const stateTone = getConditionStateTone(condition, wait.phase);
  const signal = condition.signal;
  const timer = condition.timer;
  const hasEvidence =
    condition.dependencyTask !== undefined ||
    signal !== undefined ||
    timer !== undefined;
  const showRawTechnicalName = Boolean(condition.exprCel || timer);
  const metadataContent: ReactNode = timer ? (
    <TimerConditionDefinition timer={timer} />
  ) : (
    condition.technicalName
  );

  return (
    <div
      className={clsx(
        "scroll-mt-24 border-l-2 px-3 py-2.5 outline-none",
        stateTone.borderClassName,
        stateTone.rowClassName,
        focused && "ring-1 ring-brand-primary/40 ring-inset",
      )}
      data-testid="wait-term-row"
      ref={(node) => onRegisterRow(condition, node)}
      tabIndex={-1}
    >
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-[5.75rem_minmax(0,1fr)] md:items-start">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={clsx("size-2 rounded-full", stateTone.dotClassName)}
          />
          <span
            className={clsx(
              "text-xs leading-5 font-medium",
              stateTone.labelClassName,
            )}
          >
            {getConditionStateLabel(condition, wait.phase)}
          </span>
        </div>

        <div className="min-w-0">
          <div
            className={clsx(
              "text-sm font-medium",
              condition.matched
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-700 dark:text-slate-300",
            )}
          >
            {condition.label}
          </div>
          {showRawTechnicalName ? (
            <div className="mt-0.5 min-w-0 font-mono text-xs leading-5 break-all text-slate-500 dark:text-slate-400">
              {condition.technicalName}
            </div>
          ) : null}
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <ConditionKindLabel kind={condition.kind} />
            <span
              aria-hidden="true"
              className="text-slate-400 dark:text-slate-500"
            >
              &bull;
            </span>
            {timer ? (
              <span className="min-w-0 break-words">{metadataContent}</span>
            ) : condition.exprCel ? (
              <ConditionExpression
                conditionLabel={condition.label}
                expression={condition.exprCel}
              />
            ) : (
              <span className="font-mono break-all">{metadataContent}</span>
            )}
          </div>
        </div>

        {hasEvidence ? (
          <div className="min-w-0 md:col-start-2">
            <ConditionEvidence condition={condition} wait={wait} />
          </div>
        ) : null}
      </div>

      {signal ? (
        <ConditionSignalEvidenceDisclosure
          onLoadMore={onLoadMore}
          onToggle={() =>
            onToggleConditionSignals(signalSurfaceForCondition(condition))
          }
          open={
            openSignalSurface?.kind === "condition" &&
            getSignalSurfaceStateKey(openSignalSurface) ===
              getConditionSignalStateKey(condition)
          }
          phase={wait.phase}
          signal={signal}
          signalListState={signalListState}
          surface={signalSurfaceForCondition(condition)}
        />
      ) : null}
    </div>
  );
};

const ConditionExpression = ({
  conditionLabel,
  expression,
}: {
  conditionLabel: string;
  expression: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const expressionID = useId();
  const isLongExpression =
    expression.length > INLINE_CEL_MAX_LENGTH || /[\r\n]/.test(expression);

  if (!isLongExpression) {
    return (
      <code className="rounded border border-slate-200 bg-slate-50 box-decoration-clone px-1 py-0.5 font-mono break-all text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
        {expression}
      </code>
    );
  }

  const previewExpression = getExpressionPreview(expression);
  const buttonLabel = `${expanded ? "Hide" : "Show"} full CEL expression for ${conditionLabel}`;

  return (
    <>
      <button
        aria-controls={expressionID}
        aria-expanded={expanded}
        aria-label={buttonLabel}
        className="inline-flex max-w-full min-w-0 items-center gap-1 rounded border border-slate-300 bg-slate-50 px-1 py-0.5 text-left font-mono text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-primary/60 focus-visible:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        onClick={() => setExpanded((current) => !current)}
        title={expression}
        type="button"
      >
        <code className="min-w-0 truncate">{previewExpression}</code>
        {expanded ? (
          <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0" />
        ) : (
          <ChevronRightIcon aria-hidden="true" className="size-3 shrink-0" />
        )}
      </button>
      {expanded ? (
        <pre
          className="mt-1 max-w-full basis-full overflow-x-auto rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          id={expressionID}
        >
          <code>{expression}</code>
        </pre>
      ) : null}
    </>
  );
};

const getExpressionPreview = (expression: string): string => {
  const oneLineExpression = expression.replace(/\s+/g, " ").trim();
  if (oneLineExpression.length <= INLINE_CEL_MAX_LENGTH) {
    return `${oneLineExpression}...`;
  }

  return `${oneLineExpression.slice(0, INLINE_CEL_MAX_LENGTH)}...`;
};

const ConditionEvidence = ({
  condition,
  wait,
}: {
  condition: WaitTermView;
  wait: WorkflowTaskWait;
}) => {
  const timer = condition.timer;
  if (timer) {
    return <TimerConditionEvidence timer={timer} />;
  }

  const signal = condition.signal;
  if (signal) {
    return (
      <SignalConditionEvidence
        condition={{ ...condition, signal }}
        wait={wait}
      />
    );
  }

  const dependencyTask = condition.dependencyTask;
  if (dependencyTask) {
    return (
      <DependencyConditionEvidence
        condition={{ ...condition, dependencyTask }}
        wait={wait}
      />
    );
  }

  return null;
};

const TimerConditionDefinition = ({
  timer,
}: {
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  const delay = getTimerDelayLabel(timer);
  const anchor = timer.anchor;

  if (!delay) {
    if (!anchor) return <>Immediate</>;
    switch (anchor.kind) {
      case "task_finalized_at":
        return anchor.task ? (
          <>
            When <TimerTaskName taskName={anchor.task} /> finalizes
          </>
        ) : (
          <>When dependency finalizes</>
        );
      case "wait_started_at":
        return <>When wait starts</>;
      case "workflow_created_at":
        return <>When workflow starts</>;
      default:
        return anchor.task ? (
          <>
            {anchor.kind.replaceAll("_", " ")} (
            <TimerTaskName taskName={anchor.task} />)
          </>
        ) : (
          <>{anchor.kind.replaceAll("_", " ")}</>
        );
    }
  }

  if (!anchor) return <>After {delay}</>;
  switch (anchor.kind) {
    case "task_finalized_at":
      return anchor.task ? (
        <>
          {delay} after <TimerTaskName taskName={anchor.task} /> finalizes
        </>
      ) : (
        <>{delay} after dependency finalizes</>
      );
    case "wait_started_at":
      return <>{delay} after wait starts</>;
    case "workflow_created_at":
      return <>{delay} after workflow starts</>;
    default:
      return anchor.task ? (
        <>
          {delay} after {anchor.kind.replaceAll("_", " ")} (
          <TimerTaskName taskName={anchor.task} />)
        </>
      ) : (
        <>
          {delay} after {anchor.kind.replaceAll("_", " ")}
        </>
      );
  }
};

const TimerTaskName = ({ taskName }: { taskName: string }) => (
  <span className="font-mono text-slate-700 dark:text-slate-200">
    {taskName}
  </span>
);

const TimerConditionEvidence = ({
  timer,
}: {
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  const fired = timer.result?.fired ?? false;
  return (
    <p className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {fired ? "Fired" : "Fires"}
      </span>{" "}
      <TimerTiming timer={timer} />
    </p>
  );
};

const DependencyConditionEvidence = ({
  condition,
  wait,
}: {
  condition: {
    dependencyTask: WorkflowTask;
  } & WaitTermView;
  wait: WorkflowTaskWait;
}) => {
  if (condition.dependencyTask.finalizedAt) {
    return (
      <p className="min-w-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Finalized
        </span>{" "}
        <RelativeTimeFormatter
          addSuffix
          time={condition.dependencyTask.finalizedAt}
        />
      </p>
    );
  }

  return condition.matched ? (
    <ConditionSnapshotTiming
      label="Matched"
      resolvedLabel="by resolution"
      wait={wait}
    />
  ) : null;
};

const SignalConditionEvidence = ({
  condition,
  wait,
}: {
  condition: {
    signal: WorkflowTaskWait["inputs"]["signals"][number];
  } & WaitTermView;
  wait: WorkflowTaskWait;
}) => {
  const signalResult = condition.signal.result;
  const termResult = condition.result ?? undefined;
  return (
    <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
      <dl className="contents">
        <CompactEvidenceField label="Key" value={condition.signal.key} />
        <CompactEvidenceField
          label="Included"
          value={(signalResult?.includedCount ?? 0).toString()}
        />
        {termResult ? (
          <CompactEvidenceField
            label="Matched"
            value={termResult.matchedCount.toString()}
          />
        ) : null}
        {signalResult?.lastIncludedID ? (
          <CompactEvidenceField
            label="Last included"
            value={`#${signalResult.lastIncludedID.toString()}`}
          />
        ) : null}
        {termResult?.lastMatchedID ? (
          <CompactEvidenceField
            label="Last matched"
            value={`#${termResult.lastMatchedID.toString()}`}
          />
        ) : null}
      </dl>
      {condition.matched ? (
        <ConditionSnapshotTiming
          label="Satisfied"
          resolvedLabel="by resolution"
          wait={wait}
        />
      ) : null}
    </div>
  );
};

const ConditionSnapshotTiming = ({
  label,
  resolvedLabel,
  wait,
}: {
  label: string;
  resolvedLabel: string;
  wait: WorkflowTaskWait;
}) => {
  const time = wait.resolvedAt ?? wait.evidence?.evaluatedAt;
  if (!time) return null;

  return (
    <span className="min-w-0">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>{" "}
      {wait.resolvedAt ? resolvedLabel : "by evaluation"}{" "}
      <RelativeTimeFormatter addSuffix time={time} />
    </span>
  );
};

const CompactEvidenceField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-mono break-all text-slate-800 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
};

const ConditionKindLabel = ({ kind }: { kind: string }) => {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <ConditionKindIcon kind={kind} />
      <span className="truncate">{getWaitTermKindLabel(kind)}</span>
    </span>
  );
};

export const ConditionKindIcon = ({
  className,
  kind,
}: {
  className?: string;
  kind: string;
}) => {
  switch (kind) {
    case "dep_input":
    case "generic":
      return (
        <LinkIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    case "signal":
    case "signal_input":
      return (
        <InboxIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    case "timer":
    case "timer_input":
      return (
        <ClockIcon aria-hidden="true" className={clsx("size-3.5", className)} />
      );
    default:
      return null;
  }
};

const TimerTiming = ({
  timer,
}: {
  timer: WorkflowTaskWait["inputs"]["timers"][number];
}) => {
  if (!timer.fireAt) {
    return <span>{formatTimerAnchorWait(timer.anchor)}</span>;
  }

  return <RelativeTimeFormatter addSuffix time={timer.fireAt} />;
};

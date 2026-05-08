import { Badge } from "@components/Badge";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { type WorkflowTaskWait } from "@services/workflows";
import { formatDurationShort } from "@utils/time";
import { type ReactNode } from "react";

import {
  getWaitStatusLabel,
  getWaitSummary,
} from "./WorkflowGateInspector.model";
import { type WaitTermView } from "./WorkflowGateInspector.types";

export const WaitSummary = ({
  matchedConditions,
  onSelectCondition,
  wait,
}: {
  matchedConditions: WaitTermView[];
  onSelectCondition: (conditionName: string) => void;
  wait: WorkflowTaskWait;
}) => {
  if (wait.phase === "resolved" && matchedConditions.length > 0) {
    return (
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Resolved by:{" "}
        <InlineConditionList
          conditions={matchedConditions}
          onSelectCondition={onSelectCondition}
        />
        .
      </p>
    );
  }

  return (
    <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
      {getWaitSummary(wait)}
    </p>
  );
};

const InlineConditionList = ({
  conditions,
  onSelectCondition,
}: {
  conditions: WaitTermView[];
  onSelectCondition: (conditionName: string) => void;
}) => {
  return (
    <>
      {conditions.map((condition, index) => (
        <span key={`${condition.kind}:${condition.technicalName}`}>
          {index > 0 ? ", " : null}
          <button
            className="cursor-pointer text-brand-primary hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
            onClick={() => onSelectCondition(condition.technicalName)}
            type="button"
          >
            {condition.label}
          </button>
        </span>
      ))}
    </>
  );
};

export const WaitStatusPill = ({ wait }: { wait: WorkflowTaskWait }) => {
  const color =
    wait.phase === "resolved"
      ? "green"
      : wait.phase === "unknown"
        ? "zinc"
        : "amber";

  return (
    <Badge color={color} title={getWaitStatusLabel(wait.phase)}>
      {getWaitStatusLabel(wait.phase)}
    </Badge>
  );
};

export const WaitSection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {title}
      </h4>
      {children}
    </div>
  );
};

export const WaitFacts = ({ wait }: { wait: WorkflowTaskWait }) => {
  const items = [
    wait.startedAt
      ? {
          label: "Started",
          value: <RelativeTimeFormatter addSuffix time={wait.startedAt} />,
        }
      : undefined,
    wait.resolvedAt
      ? {
          label: "Resolved",
          value: <RelativeTimeFormatter addSuffix time={wait.resolvedAt} />,
        }
      : undefined,
    wait.startedAt && wait.resolvedAt
      ? {
          label: "Waited",
          value: formatDurationShort(wait.resolvedAt, wait.startedAt, false),
        }
      : undefined,
    wait.evidence
      ? {
          label: "Evaluated",
          value: (
            <RelativeTimeFormatter addSuffix time={wait.evidence.evaluatedAt} />
          ),
        }
      : undefined,
    wait.evidence
      ? {
          label: "Workflow attempt",
          value: wait.evidence.workflowAttempt.toString(),
        }
      : undefined,
  ].filter((item) => item !== undefined);

  if (items.length === 0) return null;

  return (
    <dl className="grid max-w-4xl grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {item.label}
          </dt>
          <dd className="mt-0.5 min-w-0 text-sm text-slate-600 dark:text-slate-300">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

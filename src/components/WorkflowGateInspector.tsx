import { Badge } from "@components/Badge";
import { Subheading } from "@components/Heading";
import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import {
  type WorkflowTaskGate,
  type WorkflowTaskGateSatisfactionTimer,
  type WorkflowTaskGateTimer,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { capitalize } from "@utils/string";
import { type ReactNode } from "react";

import PlaintextPanel from "@/components/PlaintextPanel";

type WorkflowGateInspectorProps = {
  gate: WorkflowTaskGate;
  waitReason: WorkflowTaskWaitReason;
};

export default function WorkflowGateInspector({
  gate,
  waitReason,
}: WorkflowGateInspectorProps) {
  return (
    <section className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Subheading className="text-sm/6">Gate</Subheading>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            {getGateSummary(gate, waitReason)}
          </p>
        </div>
        <GateStatusPill gate={gate} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <GateFact
          label="Effect"
          value={
            isGateBlocking(gate) ? "Holding this task" : "No longer blocking"
          }
        />
        <GateFact label="Phase" value={capitalize(gate.phase)} />
        <GateFact
          label="Activated"
          value={
            gate.activeAt ? (
              <RelativeTimeFormatter addSuffix time={gate.activeAt} />
            ) : (
              "Not activated yet"
            )
          }
        />
        <GateFact
          label="Satisfied"
          value={
            gate.satisfiedAt ? (
              <RelativeTimeFormatter addSuffix time={gate.satisfiedAt} />
            ) : (
              "Not satisfied yet"
            )
          }
        />
      </div>

      <GateSection title="Expression">
        <PlaintextPanel
          codeClassName="whitespace-pre-wrap break-all"
          content={gate.exprCel || "No CEL expression declared"}
          copyTitle="Gate expression"
          rawText={gate.exprCel || "No CEL expression declared"}
        />
      </GateSection>

      {gate.declaredSignals.length > 0 ? (
        <GateSection title="Signals">
          <GateDeclaredSignals signals={gate.declaredSignals} />
        </GateSection>
      ) : null}

      {gate.timers.length > 0 ? (
        <GateSection title="Timers">
          <GateTimers
            satisfactionTimers={gate.satisfaction?.timers}
            timers={gate.timers}
          />
        </GateSection>
      ) : null}

      {gate.satisfaction ? (
        <GateSection title="Last satisfaction">
          <GateSatisfactionSummary satisfaction={gate.satisfaction} />
        </GateSection>
      ) : null}
    </section>
  );
}

export const GateStatusPill = ({ gate }: { gate: WorkflowTaskGate }) => {
  return (
    <Badge
      color={isGateBlocking(gate) ? "amber" : "green"}
      title={getGateStatusLabel(gate)}
    >
      {getGateStatusLabel(gate)}
    </Badge>
  );
};

const GateSection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => {
  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h4>
      {children}
    </div>
  );
};

const GateFact = ({ label, value }: { label: string; value: ReactNode }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
};

const GateDeclaredSignals = ({ signals }: { signals: string[] }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <Badge className="font-mono" color="light" key={signal}>
          {signal}
        </Badge>
      ))}
    </div>
  );
};

const GateTimers = ({
  satisfactionTimers,
  timers,
}: {
  satisfactionTimers?: WorkflowTaskGateSatisfactionTimer[];
  timers: WorkflowTaskGateTimer[];
}) => {
  const satisfactionTimerByName = new Map(
    (satisfactionTimers ?? []).map((timer) => [timer.name, timer]),
  );

  return (
    <div className="space-y-3">
      {timers.map((timer) => (
        <GateTimerCard
          key={timer.name}
          satisfactionTimer={satisfactionTimerByName.get(timer.name)}
          timer={timer}
        />
      ))}
    </div>
  );
};

const GateTimerCard = ({
  satisfactionTimer,
  timer,
}: {
  satisfactionTimer?: WorkflowTaskGateSatisfactionTimer;
  timer: WorkflowTaskGateTimer;
}) => {
  const timerStatus = getTimerStatus(timer, satisfactionTimer);
  const timerFields = [
    timer.anchor
      ? {
          label: "Anchor",
          value: formatTimerAnchor(timer.anchor),
        }
      : undefined,
    getTimerDelayLabel(timer)
      ? {
          label: "Delay",
          value: getTimerDelayLabel(timer)!,
        }
      : undefined,
    timer.fireAt
      ? {
          label: timerStatus.label === "Fired" ? "Fired" : "Fires",
          value: <RelativeTimeFormatter addSuffix time={timer.fireAt} />,
        }
      : undefined,
  ].filter((field) => field !== undefined);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {timer.name}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {getTimerSummary(timer, satisfactionTimer)}
          </p>
        </div>
        <Badge color={timerStatus.color}>{timerStatus.label}</Badge>
      </div>

      {timerFields.length > 0 ? (
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {timerFields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
};

const GateSatisfactionSummary = ({
  satisfaction,
}: {
  satisfaction: NonNullable<WorkflowTaskGate["satisfaction"]>;
}) => {
  const firedTimers = satisfaction.timers.filter((timer) => timer.fired);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-sm text-slate-900 dark:text-slate-100">
        Satisfied <RelativeTimeFormatter addSuffix time={satisfaction.asOf} />{" "}
        on attempt {satisfaction.attempt}
      </p>

      {satisfaction.signals.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Signals
          </div>
          <div className="space-y-2">
            {satisfaction.signals.map((signal) => (
              <div
                className="flex flex-wrap items-center gap-2 text-sm text-slate-900 dark:text-slate-100"
                key={signal.key}
              >
                <Badge className="font-mono" color="light">
                  {signal.key}
                </Badge>
                <span>count {signal.count}</span>
                {signal.lastSignalId ? (
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    last #{signal.lastSignalId.toString()}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {firedTimers.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Fired timers
          </div>
          <div className="flex flex-wrap gap-2">
            {firedTimers.map((timer) => (
              <Badge className="font-mono" color="green" key={timer.name}>
                {timer.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const isGateBlocking = (gate: WorkflowTaskGate): boolean => {
  return gate.phase !== "satisfied";
};

const getGateStatusLabel = (gate: WorkflowTaskGate): string => {
  switch (gate.phase) {
    case "inactive":
      return "Gate inactive";
    case "satisfied":
      return "Gate satisfied";
    case "waiting":
      return "Gate pending";
    default:
      return isGateBlocking(gate) ? "Gate pending" : "Gate status unknown";
  }
};

const getGateSummary = (
  gate: WorkflowTaskGate,
  waitReason: WorkflowTaskWaitReason,
): string => {
  switch (gate.phase) {
    case "inactive":
      return "This task defines gate conditions, but the gate is not active yet.";
    case "satisfied":
      return "Gate conditions are satisfied and no longer block this task.";
    case "waiting":
      switch (waitReason) {
        case "dependencies_and_gate":
          return "Dependencies and gate conditions are both still blocking this task.";
        case "gate":
          return "Dependencies are clear; the gate is the only remaining blocker.";
        default:
          return "Gate conditions are still blocking this task.";
      }
    default:
      return "Gate metadata is present, but its current state is unclear.";
  }
};

const getTimerStatus = (
  timer: WorkflowTaskGateTimer,
  satisfactionTimer?: WorkflowTaskGateSatisfactionTimer,
): { color: "blue" | "green" | "zinc"; label: string } => {
  if (satisfactionTimer?.fired) {
    return { color: "green", label: "Fired" };
  }
  if (timer.fireAt) {
    return { color: "blue", label: "Scheduled" };
  }

  return { color: "zinc", label: "Waiting" };
};

const getTimerSummary = (
  timer: WorkflowTaskGateTimer,
  satisfactionTimer?: WorkflowTaskGateSatisfactionTimer,
): string => {
  if (satisfactionTimer?.fired) {
    return "This timer contributed to the satisfied gate snapshot.";
  }
  if (timer.fireAt) {
    return "This timer is scheduled and waiting to fire.";
  }
  if (timer.anchor || timer.hasAfter || timer.after) {
    return "This timer is declared but not scheduled yet.";
  }

  return "This timer is declared as part of the gate expression.";
};

const formatTimerAnchor = (
  anchor: NonNullable<WorkflowTaskGateTimer["anchor"]>,
): string => {
  const anchorKind = anchor.kind.replaceAll("_", " ");

  if (anchor.task) {
    return `${anchorKind} (${anchor.task})`;
  }

  return anchorKind;
};

const getTimerDelayLabel = (
  timer: WorkflowTaskGateTimer,
): string | undefined => {
  if (timer.after) return timer.after;
  if (typeof timer.afterSeconds !== "number") return undefined;

  if (Number.isInteger(timer.afterSeconds)) {
    return `+${timer.afterSeconds.toString()}s`;
  }

  return `+${timer.afterSeconds.toFixed(1)}s`;
};

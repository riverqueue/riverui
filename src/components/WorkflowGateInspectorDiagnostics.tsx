import RelativeTimeFormatter from "@components/RelativeTimeFormatter";
import { type WorkflowTaskWaitDiagnostics } from "@services/workflows";
import { type ReactNode } from "react";

import { type WaitDiagnosticsState } from "./WorkflowGateInspector.types";
import { WaitSection } from "./WorkflowGateInspectorSummary";

export const WaitDiagnosticsPanel = ({
  diagnosticsState,
}: {
  diagnosticsState: WaitDiagnosticsState;
}) => {
  if (diagnosticsState.isLoading) {
    return (
      <WaitSection title="Waiting diagnostics">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading current wait diagnostics…
        </p>
      </WaitSection>
    );
  }

  if (diagnosticsState.error) {
    return (
      <WaitSection title="Waiting diagnostics">
        <p className="text-sm text-red-600 dark:text-red-400">
          {diagnosticsState.error}
        </p>
      </WaitSection>
    );
  }

  const diagnostics = diagnosticsState.value;
  if (!diagnostics) return null;
  const evalMessage = getDiagnosticsEvalMessage(diagnostics);

  return (
    <WaitSection title="Waiting diagnostics">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Current status for declared wait inputs.</p>
        <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
          <CompactDiagnosticsField
            label="Workflow attempt"
            value={diagnostics.workflowAttempt.toString()}
          />
          <CompactDiagnosticsField
            label="Inspected"
            value={
              <RelativeTimeFormatter addSuffix time={diagnostics.inspectedAt} />
            }
          />
          <CompactDiagnosticsField
            label="Expression"
            value={
              diagnostics.exprResult === undefined
                ? "Not evaluated"
                : diagnostics.exprResult
                  ? "Satisfied"
                  : "Waiting"
            }
          />
          <CompactDiagnosticsField
            label="Signal scan"
            value={`${diagnostics.signalScanCount.toLocaleString()} / ${diagnostics.signalScanLimit.toLocaleString()}`}
          />
        </dl>
        {diagnostics.truncated ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Signal diagnostics reached the scan limit, so expression and match
            counts are best effort.
          </p>
        ) : null}
        {evalMessage ? (
          <p
            className={
              evalMessage.tone === "neutral"
                ? "text-sm text-slate-600 dark:text-slate-300"
                : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            }
          >
            {evalMessage.message}
          </p>
        ) : null}
      </div>
    </WaitSection>
  );
};

const CompactDiagnosticsField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
    </dt>
    <dd className="mt-0.5 min-w-0 text-sm text-slate-900 dark:text-slate-100">
      {value}
    </dd>
  </div>
);

const getDiagnosticsEvalMessage = (
  diagnostics: WorkflowTaskWaitDiagnostics,
): { message: string; tone: "neutral" | "warning" } | undefined => {
  if (!diagnostics.evalError) return undefined;

  const hasUnavailableDepOutput = diagnostics.inputs.deps.some(
    (dep) => !dep.available,
  );
  if (diagnostics.phase === "not_started" && hasUnavailableDepOutput) {
    return {
      message: "Waiting for dependency output.",
      tone: "neutral",
    };
  }

  return {
    message: diagnostics.evalError,
    tone: "warning",
  };
};

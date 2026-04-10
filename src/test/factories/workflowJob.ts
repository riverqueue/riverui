import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import {
  type WorkflowTask,
  type WorkflowTaskGate,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Factory } from "fishery";

import { jobFactory } from "./job";

const defaultWorkflowStagedAt = new Date("2025-01-01T00:00:00.000Z");
const defaultWorkflowID = "wf-1";

type WorkflowJobFactoryParams = {
  deps?: string[];
  gate?: WorkflowTaskGate;
  id?: bigint | number;
  ignoreCancelledDeps?: boolean;
  ignoreDeletedDeps?: boolean;
  ignoreDiscardedDeps?: boolean;
  state?: JobState;
  task?: string;
  waitReason?: WorkflowTaskWaitReason;
  workflowID?: string;
  workflowStagedAt?: Date;
};

export const workflowJobFactory = Factory.define<
  WorkflowTask,
  object,
  WorkflowTask,
  WorkflowJobFactoryParams
>(({ params, sequence }) => {
  const id =
    typeof params.id === "bigint" ? params.id : BigInt(params.id ?? sequence);

  const task = params.task ?? `task-${id.toString()}`;
  const workflowStagedAt = params.workflowStagedAt ?? defaultWorkflowStagedAt;

  const baseJob = jobFactory.build({
    createdAt: workflowStagedAt,
    id,
    kind: `job-${task}`,
    scheduledAt: workflowStagedAt,
    state: params.state ?? JobState.Available,
  });

  const job: JobWithKnownMetadata = {
    ...baseJob,
    metadata: {
      deps: params.deps ?? [],
      task,
      workflow_id: params.workflowID ?? defaultWorkflowID,
      workflow_staged_at: workflowStagedAt.toISOString(),
    },
  };

  return {
    ...job,
    deps: params.deps ?? [],
    gate: params.gate,
    ignoreCancelledDeps: params.ignoreCancelledDeps ?? false,
    ignoreDeletedDeps: params.ignoreDeletedDeps ?? false,
    ignoreDiscardedDeps: params.ignoreDiscardedDeps ?? false,
    name: task,
    stagedAt: workflowStagedAt,
    waitReason:
      params.waitReason ??
      (() => {
        if (params.state !== JobState.Pending) return "none";

        const hasDependencyBlockers = (params.deps ?? []).length > 0;
        const hasGateBlocker =
          params.gate !== undefined && params.gate.phase !== "satisfied";

        if (hasDependencyBlockers && hasGateBlocker) {
          return "dependencies_and_gate";
        }
        if (hasDependencyBlockers) return "dependencies";
        if (hasGateBlocker) return "gate";

        return "none";
      })(),
    workflowID: params.workflowID ?? defaultWorkflowID,
  };
});

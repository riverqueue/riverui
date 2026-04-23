import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import {
  type WorkflowTask,
  type WorkflowTaskWaitCondition,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Factory } from "fishery";

import { jobFactory } from "./job";

const defaultWorkflowStagedAt = new Date("2025-01-01T00:00:00.000Z");
const defaultWorkflowID = "wf-1";

type WorkflowJobFactoryParams = {
  deps?: string[];
  id?: bigint | number;
  ignoreCancelledDeps?: boolean;
  ignoreDeletedDeps?: boolean;
  ignoreDiscardedDeps?: boolean;
  state?: JobState;
  task?: string;
  wait?: WorkflowTaskWaitCondition;
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
    ignoreCancelledDeps: params.ignoreCancelledDeps ?? false,
    ignoreDeletedDeps: params.ignoreDeletedDeps ?? false,
    ignoreDiscardedDeps: params.ignoreDiscardedDeps ?? false,
    name: task,
    stagedAt: workflowStagedAt,
    wait: params.wait,
    waitReason:
      params.waitReason ??
      (() => {
        if (params.state !== JobState.Pending) return "none";

        const hasDependencyBlockers = (params.deps ?? []).length > 0;
        const hasWaitConditionBlocker =
          params.wait !== undefined && params.wait.phase !== "resolved";

        if (hasDependencyBlockers && hasWaitConditionBlocker) {
          return "dependencies_and_wait_condition";
        }
        if (hasDependencyBlockers) return "dependencies";
        if (hasWaitConditionBlocker) return "wait_condition";

        return "none";
      })(),
    workflowID: params.workflowID ?? defaultWorkflowID,
  };
});

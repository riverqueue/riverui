import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import {
  type WorkflowTask,
  type WorkflowTaskWait,
  type WorkflowTaskWaitReason,
} from "@services/workflows";
import { Factory } from "fishery";

import { jobFactory } from "./job";

const defaultWorkflowStagedAt = new Date("2025-01-01T00:00:00.000Z");
const defaultWorkflowID = "wf-1";

type WorkflowJobFactoryParams = {
  argsRaw?: string;
  attemptedAt?: Date;
  createdAt?: Date;
  deps?: string[];
  finalizedAt?: Date;
  id?: bigint | number;
  ignoreCancelledDeps?: boolean;
  ignoreDeletedDeps?: boolean;
  ignoreDiscardedDeps?: boolean;
  scheduledAt?: Date;
  stagedAt?: Date;
  state?: JobState;
  task?: string;
  wait?: WorkflowTaskWait;
  waitReason?: WorkflowTaskWaitReason;
  workflowID?: string;
  workflowStagedAt?: Date;
};

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1000);

const sampleRuntimeSeconds = (id: bigint): number => 4 + Number(id % 9n) * 3;

const sampleQueueDelaySeconds = (id: bigint): number => 8 + Number(id % 5n) * 4;

export const workflowJobFactory = Factory.define<
  WorkflowTask,
  object,
  WorkflowTask,
  WorkflowJobFactoryParams
>(({ afterBuild, params, sequence }) => {
  const id =
    typeof params.id === "bigint" ? params.id : BigInt(params.id ?? sequence);

  const task = params.task ?? `task-${id.toString()}`;
  const state = params.state ?? JobState.Available;
  const runtimeSeconds = sampleRuntimeSeconds(id);
  const queueDelaySeconds = sampleQueueDelaySeconds(id);

  let attemptedAt = params.attemptedAt;
  let finalizedAt = params.finalizedAt;

  if (state === JobState.Completed && !attemptedAt && finalizedAt) {
    attemptedAt = addSeconds(finalizedAt, -runtimeSeconds);
  }

  const createdAt =
    params.createdAt ??
    (attemptedAt
      ? addSeconds(attemptedAt, -queueDelaySeconds)
      : (params.scheduledAt ??
        params.stagedAt ??
        params.workflowStagedAt ??
        defaultWorkflowStagedAt));
  const scheduledAt = params.scheduledAt ?? createdAt;
  const workflowStagedAt =
    params.workflowStagedAt ?? params.stagedAt ?? createdAt;
  const stagedAt = params.stagedAt ?? workflowStagedAt;

  if (state === JobState.Completed) {
    attemptedAt ??= addSeconds(createdAt, queueDelaySeconds);
    finalizedAt ??= addSeconds(attemptedAt, runtimeSeconds);
  } else if (state === JobState.Running) {
    attemptedAt ??= addSeconds(createdAt, queueDelaySeconds);
  }

  const baseJob = jobFactory.build({
    ...(attemptedAt ? { attemptedAt } : {}),
    ...(params.argsRaw ? { argsRaw: params.argsRaw } : {}),
    createdAt,
    ...(finalizedAt ? { finalizedAt } : {}),
    id,
    kind: `job-${task}`,
    scheduledAt,
    state,
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

  const workflowTask: WorkflowTask = {
    ...job,
    deps: params.deps ?? [],
    ignoreCancelledDeps: params.ignoreCancelledDeps ?? false,
    ignoreDeletedDeps: params.ignoreDeletedDeps ?? false,
    ignoreDiscardedDeps: params.ignoreDiscardedDeps ?? false,
    name: task,
    stagedAt,
    wait: params.wait,
    waitReason:
      params.waitReason ??
      (() => {
        if (state !== JobState.Pending) return "none";

        const hasDependencyBlockers = (params.deps ?? []).length > 0;
        const hasWaitBlocker =
          params.wait !== undefined && params.wait.phase !== "resolved";

        if (hasDependencyBlockers && hasWaitBlocker) {
          return "dependencies_and_wait";
        }
        if (hasDependencyBlockers) return "dependencies";
        if (hasWaitBlocker) return "wait";

        return "none";
      })(),
    workflowID: params.workflowID ?? defaultWorkflowID,
  };

  afterBuild((builtTask) => {
    builtTask.createdAt = createdAt;
    builtTask.scheduledAt = scheduledAt;
    builtTask.stagedAt = stagedAt;

    if (attemptedAt) {
      builtTask.attemptedAt = attemptedAt;
    }
    if (finalizedAt) {
      builtTask.finalizedAt = finalizedAt;
    }
  });

  return workflowTask;
});

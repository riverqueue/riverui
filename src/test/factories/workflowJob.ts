import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { Factory } from "fishery";

import { jobFactory } from "./job";

const defaultWorkflowStagedAt = new Date("2025-01-01T00:00:00.000Z");
const defaultWorkflowID = "wf-1";

type WorkflowJobFactoryParams = {
  deps?: string[];
  id?: bigint | number;
  state?: JobState;
  task?: string;
  workflowID?: string;
  workflowStagedAt?: Date;
};

export const workflowJobFactory = Factory.define<
  JobWithKnownMetadata,
  object,
  JobWithKnownMetadata,
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

  return {
    ...baseJob,
    metadata: {
      deps: params.deps ?? [],
      task,
      workflow_id: params.workflowID ?? defaultWorkflowID,
      workflow_staged_at: workflowStagedAt.toISOString(),
    },
  };
});

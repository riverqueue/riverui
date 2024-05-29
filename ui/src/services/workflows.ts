import type { QueryFunction } from "@tanstack/react-query";

import { API } from "@utils/api";
import { JobFromAPI, JobWithKnownMetadata, apiJobToJob } from "@services/jobs";

// Represents Job as received from the API. This just like Job, except with
// string dates instead of Date objects and keys as snake_case instead of
// camelCase.
type WorkflowFromAPI = {
  tasks: JobFromAPI[];
};

export type Workflow = {
  tasks: JobWithKnownMetadata[];
};

type GetWorkflowKey = ["getWorkflow", string];

export const getWorkflowKey = (id: string): GetWorkflowKey => {
  return ["getWorkflow", id.toString()];
};

export const getWorkflow: QueryFunction<Workflow, GetWorkflowKey> = async ({
  queryKey,
  signal,
}) => {
  const [, workflowID] = queryKey;
  return API.get<WorkflowFromAPI>(
    { path: `/workflows/${workflowID}` },
    { signal }
  ).then(apiWorkflowToWorkflow);
};

const apiWorkflowToWorkflow = (job: WorkflowFromAPI): Workflow => ({
  tasks: job.tasks.map(apiJobToJob) as JobWithKnownMetadata[],
});

import type { Meta, StoryObj } from "@storybook/react-vite";

import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { Workflow } from "@services/workflows";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { createFeatures } from "@test/utils/features";

import WorkflowDetail from "./WorkflowDetail";

const workflowID = "wf_visual_001";
const workflowName = "Nightly Billing Workflow";
const workflowStagedAt = new Date("2025-02-28T12:00:00.000Z");

const buildTask = (
  id: bigint,
  task: string,
  state: JobState,
  deps: string[] = [],
): JobWithKnownMetadata => {
  const workflowTask = workflowJobFactory
    .params({
      deps,
      id,
      state,
      task,
      workflowID,
      workflowStagedAt,
    })
    .build();

  return {
    ...workflowTask,
    metadata: {
      ...workflowTask.metadata,
      workflow_name: workflowName,
    },
  };
};

const visualWorkflow: Workflow = {
  tasks: [
    buildTask(BigInt(101), "ingest", JobState.Completed),
    buildTask(BigInt(102), "validate", JobState.Running, ["ingest"]),
    buildTask(BigInt(103), "notify", JobState.Pending, ["validate"]),
    buildTask(BigInt(104), "archive", JobState.Pending, ["validate"]),
  ],
};

const meta: Meta<typeof WorkflowDetail> = {
  component: WorkflowDetail,
  title: "Pages/WorkflowDetail",
};

export default meta;
type Story = StoryObj<typeof WorkflowDetail>;

export const VisualRegression: Story = {
  args: {
    cancelPending: false,
    loading: false,
    onCancel: () => {},
    onRetry: () => {},
    retryPending: false,
    selectedJobId: BigInt(102),
    setSelectedJobId: () => {},
    workflow: visualWorkflow,
  },
  parameters: {
    features: createFeatures({
      hasWorkflows: true,
      workflowQueries: true,
    }),
    router: {
      initialEntries: [`/workflows/${workflowID}`],
      routes: ["/jobs/$jobId", "/workflows/$workflowId"],
    },
    visual: {
      waitFor: ".react-flow__node",
    },
  },
  tags: ["visual"],
};

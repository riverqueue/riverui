import type { Edge } from "@xyflow/react";

import { JobWithKnownMetadata } from "@services/jobs";
import { JobState } from "@services/types";
import { describe, expect, it } from "vitest";

import {
  applyEdgeVisuals,
  buildWorkflowGraphModel,
  depStatusFromJob,
} from "./workflowDiagramGraphModel";

const baseDate = new Date("2025-01-01T00:00:00.000Z");

const workflowJob = ({
  deps = [],
  id,
  state = JobState.Available,
  task,
  workflowID = "wf-1",
}: {
  deps?: string[];
  id: number;
  state?: JobState;
  task: string;
  workflowID?: string;
}): JobWithKnownMetadata => ({
  args: {},
  attempt: 0,
  attemptedAt: undefined,
  attemptedBy: [],
  createdAt: baseDate,
  errors: [],
  finalizedAt: undefined,
  id: BigInt(id),
  kind: `job-${task}`,
  logs: {},
  maxAttempts: 1,
  metadata: {
    deps,
    task,
    workflow_id: workflowID,
    workflow_staged_at: baseDate.toISOString(),
  },
  priority: 1,
  queue: "default",
  scheduledAt: baseDate,
  state,
  tags: [],
});

describe("buildWorkflowGraphModel", () => {
  it("returns one node and zero edges for a single task", () => {
    const model = buildWorkflowGraphModel([workflowJob({ id: 1, task: "a" })]);

    expect(model.nodes).toHaveLength(1);
    expect(model.edges).toHaveLength(0);
    expect(model.nodes[0].id).toBe("1");
  });

  it("builds dependency edges in deterministic task/dep order", () => {
    const tasks = [
      workflowJob({ id: 1, task: "task-a" }),
      workflowJob({ deps: ["task-a"], id: 2, task: "task-b" }),
      workflowJob({ deps: ["task-a", "task-b"], id: 3, task: "task-c" }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(model.edges.map((edge) => edge.id)).toEqual([
      "e-1-2",
      "e-1-3",
      "e-2-3",
    ]);
    expect(model.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(
      ["1->2", "1->3", "2->3"],
    );
  });

  it("maps job states to dependency statuses", () => {
    expect(
      depStatusFromJob(
        workflowJob({ id: 1, state: JobState.Completed, task: "a" }),
      ),
    ).toBe("unblocked");
    expect(
      depStatusFromJob(
        workflowJob({ id: 2, state: JobState.Cancelled, task: "b" }),
      ),
    ).toBe("failed");
    expect(
      depStatusFromJob(
        workflowJob({ id: 3, state: JobState.Discarded, task: "c" }),
      ),
    ).toBe("failed");
    expect(
      depStatusFromJob(
        workflowJob({ id: 4, state: JobState.Running, task: "d" }),
      ),
    ).toBe("blocked");
  });

  it("drops missing dependency targets", () => {
    const tasks = [
      workflowJob({ id: 1, task: "existing" }),
      workflowJob({ deps: ["missing", "existing"], id: 2, task: "consumer" }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].id).toBe("e-1-2");
  });

  it("sets upstream and downstream flags on node data", () => {
    const tasks = [
      workflowJob({ id: 1, task: "a" }),
      workflowJob({ deps: ["a"], id: 2, task: "b" }),
      workflowJob({ deps: ["b"], id: 3, task: "c" }),
    ];

    const model = buildWorkflowGraphModel(tasks);
    const nodeByID = new Map(model.nodes.map((node) => [node.id, node]));

    expect(nodeByID.get("1")?.data.hasUpstreamDeps).toBe(false);
    expect(nodeByID.get("1")?.data.hasDownstreamDeps).toBe(true);

    expect(nodeByID.get("2")?.data.hasUpstreamDeps).toBe(true);
    expect(nodeByID.get("2")?.data.hasDownstreamDeps).toBe(true);

    expect(nodeByID.get("3")?.data.hasUpstreamDeps).toBe(true);
    expect(nodeByID.get("3")?.data.hasDownstreamDeps).toBe(false);
  });

  it("animates only blocked dependencies when downstream job is pending", () => {
    const tasks = [
      workflowJob({ id: 1, state: JobState.Available, task: "source-blocked" }),
      workflowJob({
        id: 2,
        state: JobState.Completed,
        task: "source-unblocked",
      }),
      workflowJob({
        deps: ["source-blocked"],
        id: 3,
        state: JobState.Pending,
        task: "consumer-pending",
      }),
      workflowJob({
        deps: ["source-unblocked"],
        id: 4,
        state: JobState.Pending,
        task: "consumer-pending-unblocked",
      }),
      workflowJob({
        deps: ["source-blocked"],
        id: 5,
        state: JobState.Cancelled,
        task: "consumer-not-waiting",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);
    const edgeByID = new Map(model.edges.map((edge) => [edge.id, edge]));

    expect(edgeByID.get("e-1-3")?.animated).toBe(true);
    expect(edgeByID.get("e-2-4")?.animated).toBe(false);
    expect(edgeByID.get("e-1-5")?.animated).toBe(false);
  });

  it("returns empty arrays for empty input", () => {
    const model = buildWorkflowGraphModel([]);

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
  });

  it("treats missing metadata.deps as an empty dependency list", () => {
    const malformedJob = workflowJob({ id: 1, task: "a" });
    (
      malformedJob.metadata as unknown as {
        deps?: string[];
      }
    ).deps = undefined;

    const model = buildWorkflowGraphModel([malformedJob]);

    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].data.hasUpstreamDeps).toBe(false);
    expect(model.edges).toEqual([]);
  });
});

describe("applyEdgeVisuals", () => {
  it("applies status-specific styles and preserves edge order", () => {
    const edges: Edge[] = [
      {
        data: { depStatus: "blocked" },
        id: "blocked-edge",
        source: "1",
        target: "2",
      },
      {
        data: { depStatus: "failed" },
        id: "failed-edge",
        source: "2",
        target: "3",
      },
      {
        data: { depStatus: "unblocked" },
        id: "unblocked-edge",
        source: "3",
        target: "4",
      },
    ];

    const styledEdges = applyEdgeVisuals(edges, {
      blocked: "#111111",
      failed: "#222222",
      unblocked: "#333333",
    });

    expect(styledEdges.map((edge) => edge.id)).toEqual([
      "blocked-edge",
      "failed-edge",
      "unblocked-edge",
    ]);

    expect(styledEdges[0].style).toMatchObject({
      stroke: "#111111",
      strokeDasharray: "6 3",
      strokeWidth: 2,
    });
    expect(styledEdges[1].style).toMatchObject({
      stroke: "#222222",
      strokeDasharray: "6 3",
      strokeWidth: 2,
    });
    expect(styledEdges[2].style).toMatchObject({
      stroke: "#333333",
      strokeDasharray: "0",
      strokeWidth: 2,
    });
  });
});

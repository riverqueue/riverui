import type { Edge } from "@xyflow/react";

import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { describe, expect, it } from "vitest";

import { nodeHeight, switchHandleCenterGap } from "./workflowDiagramConstants";
import {
  applyEdgeVisuals,
  buildWorkflowGraphModel,
  depStatusFromJob,
} from "./workflowDiagramGraphModel";

const targetAnchorOffsetX = (edgeData: unknown): number | undefined => {
  if (!edgeData || typeof edgeData !== "object") return undefined;
  const value = (edgeData as { targetAnchorOffsetX?: unknown })
    .targetAnchorOffsetX;
  return typeof value === "number" ? value : undefined;
};

describe("buildWorkflowGraphModel", () => {
  it("returns one node and zero edges for a single task", () => {
    const model = buildWorkflowGraphModel([
      workflowJobFactory.build({ id: 1, task: "a" }),
    ]);

    expect(model.nodes).toHaveLength(1);
    expect(model.edges).toHaveLength(0);
    expect(model.nodes[0].id).toBe("1");
  });

  it("builds dependency edges in deterministic task/dep order", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "task-a" }),
      workflowJobFactory.build({ deps: ["task-a"], id: 2, task: "task-b" }),
      workflowJobFactory.build({
        deps: ["task-a", "task-b"],
        id: 3,
        task: "task-c",
      }),
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
        workflowJobFactory.build({
          id: 1,
          state: JobState.Completed,
          task: "a",
        }),
      ),
    ).toBe("unblocked");
    expect(
      depStatusFromJob(
        workflowJobFactory.build({
          id: 2,
          state: JobState.Cancelled,
          task: "b",
        }),
      ),
    ).toBe("failed");
    expect(
      depStatusFromJob(
        workflowJobFactory.build({
          id: 3,
          state: JobState.Discarded,
          task: "c",
        }),
      ),
    ).toBe("failed");
    expect(
      depStatusFromJob(
        workflowJobFactory.build({
          id: 4,
          state: JobState.Running,
          task: "d",
        }),
      ),
    ).toBe("blocked");
  });

  it("drops missing dependency targets", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "existing" }),
      workflowJobFactory.build({
        deps: ["missing", "existing"],
        id: 2,
        task: "consumer",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].id).toBe("e-1-2");
  });

  it("sets upstream and downstream flags on node data", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "a" }),
      workflowJobFactory.build({
        deps: ["a"],
        id: 2,
        state: JobState.Pending,
        task: "b",
        waitReason: "dependencies",
      }),
      workflowJobFactory.build({
        deps: ["b"],
        id: 3,
        state: JobState.Pending,
        task: "c",
        waitReason: "dependencies",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);
    const nodeByID = new Map(model.nodes.map((node) => [node.id, node]));

    expect(nodeByID.get("1")?.data.hasUpstreamDeps).toBe(false);
    expect(nodeByID.get("1")?.data.hasDownstreamDeps).toBe(true);
    expect(nodeByID.get("1")?.data.waitReason).toBe("none");

    expect(nodeByID.get("2")?.data.hasUpstreamDeps).toBe(true);
    expect(nodeByID.get("2")?.data.hasDownstreamDeps).toBe(true);
    expect(nodeByID.get("2")?.data.waitReason).toBe("dependencies");

    expect(nodeByID.get("3")?.data.hasUpstreamDeps).toBe(true);
    expect(nodeByID.get("3")?.data.hasDownstreamDeps).toBe(false);
    expect(nodeByID.get("3")?.data.waitReason).toBe("dependencies");
  });

  it("keeps gate-blocked tasks as gate wait reasons on nodes", () => {
    const tasks = [
      workflowJobFactory.build({
        gate: {
          declaredSignals: [],
          enabled: true,
          exprCel: 'signals["approval"].size() > 0',
          phase: "waiting",
          timers: [],
        },
        id: 1,
        state: JobState.Pending,
        task: "gate-wait",
        waitReason: "gate",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(model.nodes[0].data.waitReason).toBe("gate");
    expect(model.nodes[0].height).toBe(nodeHeight);
  });

  it("shifts edges to the gate hinge anchor for gated targets", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "upstream" }),
      workflowJobFactory.build({
        deps: ["upstream"],
        gate: {
          declaredSignals: [],
          enabled: true,
          exprCel: 'signals["approval"].size() > 0',
          phase: "waiting",
          timers: [],
        },
        id: 2,
        state: JobState.Pending,
        task: "gated-target",
        waitReason: "dependencies_and_gate",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(targetAnchorOffsetX(model.edges[0].data)).toBe(
      -switchHandleCenterGap,
    );
  });

  it("uses uniform height for all nodes regardless of gate presence", () => {
    const model = buildWorkflowGraphModel([
      workflowJobFactory.build({
        id: 1,
        state: JobState.Pending,
        task: "plain-pending",
        waitReason: "dependencies",
      }),
    ]);

    expect(model.nodes[0].height).toBe(nodeHeight);
  });

  it("returns empty arrays for empty input", () => {
    const model = buildWorkflowGraphModel([]);

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
  });

  it("treats missing deps as an empty dependency list", () => {
    const malformedJob = workflowJobFactory.build({ id: 1, task: "a" });
    (malformedJob as unknown as { deps?: string[] }).deps = undefined;

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

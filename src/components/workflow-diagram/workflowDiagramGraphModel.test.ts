import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { describe, expect, it } from "vitest";

import {
  nodeHeight,
  nodeWidth,
  switchHandleCenterGap,
} from "./workflowDiagramConstants";
import {
  buildWorkflowGraphModel,
  depStatusFromJob,
} from "./workflowDiagramGraphModel";

const isFinitePoint = (point: unknown): boolean =>
  point !== null &&
  typeof point === "object" &&
  "x" in point &&
  "y" in point &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y);

const targetAnchorOffsetX = (edgeData: unknown): number | undefined => {
  if (!edgeData || typeof edgeData !== "object") return undefined;
  const value = (edgeData as { targetAnchorOffsetX?: unknown })
    .targetAnchorOffsetX;
  return typeof value === "number" ? value : undefined;
};

describe("buildWorkflowGraphModel", () => {
  it("builds deterministic dependency edges", () => {
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
  });

  it("lays out a fork and join with Dagre node positions and edge routes", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "start" }),
      workflowJobFactory.build({ deps: ["start"], id: 2, task: "branch-a" }),
      workflowJobFactory.build({ deps: ["start"], id: 3, task: "branch-b" }),
      workflowJobFactory.build({
        deps: ["branch-a", "branch-b"],
        id: 4,
        task: "join",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);
    const [start, branchA, branchB, join] = model.nodes;

    expect(model.nodes).toHaveLength(4);
    for (const node of model.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
      expect(node.sourcePosition).toBe("right");
      expect(node.targetPosition).toBe("left");
    }
    for (const branch of [branchA, branchB]) {
      expect(branch.position.x).toBeGreaterThan(start.position.x + nodeWidth);
      expect(join.position.x).toBeGreaterThan(branch.position.x + nodeWidth);
    }
    expect(Math.abs(branchA.position.y - branchB.position.y)).toBeGreaterThan(
      nodeHeight,
    );
    expect(model.edges).toHaveLength(4);
    for (const edge of model.edges) {
      const points: unknown = edge.data?.dagrePoints;
      if (!Array.isArray(points))
        throw new Error("Expected a Dagre edge route");
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points.every(isFinitePoint)).toBe(true);
    }
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
        workflowJobFactory.build({ id: 3, state: JobState.Running, task: "c" }),
      ),
    ).toBe("blocked");
  });

  it("shifts edges to the gate hinge anchor for wait targets", () => {
    const tasks = [
      workflowJobFactory.build({ id: 1, task: "upstream" }),
      workflowJobFactory.build({
        deps: ["upstream"],
        id: 2,
        state: JobState.Pending,
        task: "await_review",
        wait: {
          exprCel: "approval_received",
          inputs: { deps: [], signals: [], timers: [] },
          phase: "waiting",
          terms: [],
        },
        waitReason: "dependencies_and_wait",
      }),
    ];

    const model = buildWorkflowGraphModel(tasks);

    expect(targetAnchorOffsetX(model.edges[0]?.data)).toBe(
      -switchHandleCenterGap,
    );
  });
});

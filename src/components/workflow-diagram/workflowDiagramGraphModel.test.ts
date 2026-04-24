import { JobState } from "@services/types";
import { workflowJobFactory } from "@test/factories/workflowJob";
import { describe, expect, it } from "vitest";

import { switchHandleCenterGap } from "./workflowDiagramConstants";
import {
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
          phase: "waiting",
          signals: [],
          terms: [],
          timers: [],
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

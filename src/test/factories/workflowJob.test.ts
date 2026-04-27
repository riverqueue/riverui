import { JobState } from "@services/types";
import { describe, expect, it } from "vitest";

import { workflowJobFactory } from "./workflowJob";

const expectValidDate = (date: Date | undefined) => {
  expect(date).toBeInstanceOf(Date);
  expect(Number.isNaN(date?.getTime())).toBe(false);
};

describe("workflowJobFactory", () => {
  it("infers valid completed task timing from finalizedAt", () => {
    const finalizedAt = new Date("2026-04-21T18:00:00.000Z");
    const task = workflowJobFactory.build({
      finalizedAt,
      id: 2001n,
      state: JobState.Completed,
      task: "collect_inputs",
    });

    expect(task.finalizedAt).toEqual(finalizedAt);
    expectValidDate(task.attemptedAt);
    expectValidDate(task.createdAt);
    expectValidDate(task.scheduledAt);
    expectValidDate(task.stagedAt);
    expect(task.attemptedAt!.getTime()).toBeLessThan(finalizedAt.getTime());
    expect(task.createdAt.getTime()).toBeLessThan(task.attemptedAt!.getTime());
  });

  it("keeps explicit completed timing coherent", () => {
    const attemptedAt = new Date("2026-04-21T18:00:05.000Z");
    const createdAt = new Date("2026-04-21T18:00:00.000Z");
    const finalizedAt = new Date("2026-04-21T18:00:12.000Z");
    const task = workflowJobFactory.build({
      attemptedAt,
      createdAt,
      finalizedAt,
      id: 2003n,
      state: JobState.Completed,
      task: "await_review",
    });

    expect(task.createdAt).toEqual(createdAt);
    expect(task.attemptedAt).toEqual(attemptedAt);
    expect(task.finalizedAt).toEqual(finalizedAt);
    expect(task.scheduledAt).toEqual(createdAt);
    expect(task.stagedAt).toEqual(createdAt);
  });

  it("ignores undefined lifecycle overrides after inferring timing", () => {
    const finalizedAt = new Date("2026-04-21T18:00:00.000Z");
    const task = workflowJobFactory.build({
      attemptedAt: undefined,
      createdAt: undefined,
      finalizedAt,
      id: 2002n,
      scheduledAt: undefined,
      stagedAt: undefined,
      state: JobState.Completed,
      task: "safety_review",
    });

    expect(task.finalizedAt).toEqual(finalizedAt);
    expectValidDate(task.attemptedAt);
    expectValidDate(task.createdAt);
    expectValidDate(task.scheduledAt);
    expectValidDate(task.stagedAt);
    expect(task.finalizedAt!.getTime()).toBeGreaterThan(
      task.attemptedAt!.getTime(),
    );
    expect(task.attemptedAt!.getTime()).toBeGreaterThan(
      task.createdAt.getTime(),
    );
  });
});

import { JobState } from "@services/types";
import { describe, expect, test } from "vitest";

import {
  formatPendingCount,
  jobSequenceFromAPI,
  sequenceJobListItemFromAPI,
  sequenceKeyFromMetadata,
  sequenceWaitSummary,
} from "./sequences";

describe("jobSequenceFromAPI", () => {
  test("preserves job IDs beyond the JavaScript integer range", () => {
    const blocker = {
      id: "1970670598291982290",
      kind: "order",
      queue: "default",
      scheduled_at: "2026-11-13T12:00:00Z",
      state: JobState.Cancelled,
    };
    const jobSequence = jobSequenceFromAPI({
      halting: false,
      job_id: "1970670598291982291",
      job_state: JobState.Pending,
      sequence: {
        blockers: [blocker],
        halted_by: blocker,
        head: null,
        key: "order",
        pending_count: null,
      },
      wait_reason: "halted",
      waiting_on: blocker,
    });
    expect(jobSequence.jobId).toBe(1970670598291982291n);
    expect(jobSequence.waitingOn?.id).toBe(1970670598291982290n);
    expect(jobSequence.sequence.haltedBy?.scheduledAt).toEqual(
      new Date("2026-11-13T12:00:00Z"),
    );
    expect(jobSequence.sequence.head).toBeNull();
  });
});

test("sequenceJobListItemFromAPI converts IDs and optional times", () => {
  const item = sequenceJobListItemFromAPI({
    args: '{"order_id":1}',
    attempt: 0,
    attempted_at: null,
    created_at: "2026-11-13T12:00:00Z",
    finalized_at: null,
    id: "9007199254740993",
    kind: "order",
    max_attempts: 25,
    priority: 1,
    queue: "default",
    scheduled_at: "2026-11-13T12:00:00Z",
    state: JobState.Pending,
  });
  expect(item.id).toBe(9007199254740993n);
  expect(item.argsRaw).toBe('{"order_id":1}');
  expect(item.attemptedAt).toBeUndefined();
  expect(item.finalizedAt).toBeUndefined();
});

test("sequenceKeyFromMetadata only accepts a nonempty string key", () => {
  expect(sequenceKeyFromMetadata({ seq_key: "order" })).toBe("order");
  for (const metadata of [
    {},
    { seq_key: null },
    { seq_key: "" },
    { seq_key: 123 },
    { workflow_id: "workflow" },
  ]) {
    expect(sequenceKeyFromMetadata(metadata)).toBeUndefined();
  }
});

test("formatPendingCount marks a capped count", () => {
  expect(formatPendingCount({ count: 2341, more: false })).toBe("2,341");
  expect(formatPendingCount({ count: 1000, more: true })).toBe("1,000+");
});

describe("sequenceWaitSummary", () => {
  const status = (waitReason: "halted" | "up_next" | "waiting_on_active") => ({
    error: false,
    jobSequence: {
      halting: false,
      jobId: 1n,
      jobState: JobState.Pending,
      sequence: {
        blockers: [],
        haltedBy: null,
        head: null,
        key: "k",
        pendingCount: null,
      },
      waitingOn: null,
      waitReason,
    },
    key: "k",
  });
  const pending = { state: JobState.Pending };

  test("labels and tints a pending job's wait", () => {
    expect(sequenceWaitSummary(pending, status("halted"))).toEqual({
      label: "Sequence halted",
      tone: "halted",
    });
    expect(sequenceWaitSummary(pending, status("waiting_on_active"))).toEqual({
      label: "Waiting on sequence",
      tone: "waiting",
    });
    expect(sequenceWaitSummary(pending, status("up_next"))?.tone).toBe(
      "neutral",
    );
  });

  test("says nothing for other jobs, failures, or missing status", () => {
    expect(
      sequenceWaitSummary({ state: JobState.Completed }, status("halted")),
    ).toBeUndefined();
    expect(
      sequenceWaitSummary(pending, { ...status("halted"), error: true }),
    ).toBeUndefined();
    expect(sequenceWaitSummary(pending)).toBeUndefined();
  });
});

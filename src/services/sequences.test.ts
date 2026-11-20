import { JobState } from "@services/types";
import { expect, test } from "vitest";

import { jobSequenceFromAPI, sequenceKeyFromMetadata } from "./sequences";

test("preserves sequence job IDs beyond the JavaScript integer range", () => {
  const sequence = jobSequenceFromAPI({
    blockers: [
      {
        id: "1970670598291982290",
        kind: "invoice",
        queue: "default",
        scheduled_at: "2026-11-13T12:00:00Z",
        state: JobState.Retryable,
      },
    ],
    first_pending: null,
    job_id: "1970670598291982291",
    key: "invoice",
    wait_reason: "waiting",
  });
  expect(sequence.jobId).toBe(1970670598291982291n);
  expect(sequence.blockers[0]?.id).toBe(1970670598291982290n);
  expect(sequence.blockers[0]?.scheduledAt).toEqual(
    new Date("2026-11-13T12:00:00Z"),
  );
});

test("only requests sequence diagnostics for a nonempty sequence key", () => {
  expect(sequenceKeyFromMetadata({ seq_key: "invoice" })).toBe("invoice");
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

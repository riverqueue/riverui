import type { JobSequence, JobSequenceStatus } from "@services/sequences";

import { JobState } from "@services/types";
import {
  jobSequence,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
} from "@test/factories/sequence";
import { renderWithRouter } from "@test/utils/router";
import { visibleText } from "@test/utils/text";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SequenceStatusField } from "./JobSequenceStatus";

const halting = sequenceJob(7001n, JobState.Cancelled);
const running = sequenceJob(7002n, JobState.Running);
const head = sequenceJob(7003n, JobState.Pending);

const status = (overrides: Partial<JobSequence> = {}): JobSequenceStatus => ({
  error: false,
  jobSequence: jobSequence(overrides),
  key: sequenceKeyFixture,
});

const renderField = (
  job: { id: bigint; state: JobState },
  sequence: JobSequenceStatus,
) =>
  renderWithRouter(() => (
    <dl>
      <SequenceStatusField job={job} status={sequence} />
    </dl>
  ));

const pendingJob = { id: 7010n, state: JobState.Pending };

const fieldText = () => visibleText(screen.getByRole("definition"));

describe("SequenceStatusField", () => {
  test("links to the sequence page with the job selected", async () => {
    await renderField(pendingJob, status({ waitReason: "up_next" }));
    const link = screen.getByRole("link", { name: "View sequence" });
    expect(link).toHaveAttribute(
      "href",
      `/sequences/${encodeURIComponent(sequenceKeyFixture)}?job=7010`,
    );
  });

  test("names the job halting a pending job's sequence", async () => {
    await renderField(
      pendingJob,
      status({
        sequence: sequenceInspection({ haltedBy: halting, head }),
        waitingOn: halting,
        waitReason: "halted",
      }),
    );
    expect(screen.getByText("Halted")).toBeInTheDocument();
    expect(fieldText()).toContain("by #7001 · Cancelled");
    expect(screen.getByText("Retry or delete it to resume.")).toBeVisible();
    expect(screen.getByRole("link", { name: "#7001" })).toHaveAttribute(
      "href",
      "/jobs/7001",
    );
    // "by #7001" stays together when a narrow field wraps.
    expect(
      screen.getByRole("link", { name: "#7001" }).parentElement,
    ).toHaveClass("whitespace-nowrap");
  });

  test("names the active job a pending job waits on", async () => {
    await renderField(
      pendingJob,
      status({ waitingOn: running, waitReason: "waiting_on_active" }),
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(fieldText()).toContain("on #7002 · Running");
  });

  test("says when a retryable blocker runs again", async () => {
    await renderField(
      pendingJob,
      status({
        waitingOn: sequenceJob(7002n, JobState.Retryable, {
          scheduledAt: new Date(Date.now() + 4 * 60_000 + 5_000),
        }),
        waitReason: "waiting_on_active",
      }),
    );
    expect(fieldText()).toContain("Retrying in 4 minutes");
  });

  test("says when a retry is overdue or a blocker is scheduled", async () => {
    const { unmount } = await renderField(
      pendingJob,
      status({
        waitingOn: sequenceJob(7002n, JobState.Retryable, {
          scheduledAt: new Date(Date.now() - 2 * 60_000 - 5_000),
        }),
        waitReason: "waiting_on_active",
      }),
    );
    expect(fieldText()).toContain("Retry due 2 minutes ago");
    unmount();

    await renderField(
      pendingJob,
      status({
        waitingOn: sequenceJob(7002n, JobState.Scheduled, {
          scheduledAt: new Date(Date.now() + 2 * 60 * 60_000 + 5_000),
        }),
        waitReason: "waiting_on_active",
      }),
    );
    expect(fieldText()).toContain("on #7002 · Runs in about 2 hours");
  });

  test("names the earlier pending job a job waits behind", async () => {
    await renderField(
      pendingJob,
      status({ waitingOn: head, waitReason: "waiting_behind_pending" }),
    );
    expect(fieldText()).toContain("behind #7003 · Pending");
  });

  test("says when nothing blocks a pending job", async () => {
    await renderField(pendingJob, status({ waitReason: "up_next" }));
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(fieldText()).toContain("nothing blocking");
  });

  test("says a halting job holds back the jobs after it", async () => {
    await renderField(
      { id: 7001n, state: JobState.Cancelled },
      status({
        halting: true,
        jobState: JobState.Cancelled,
        sequence: sequenceInspection({ haltedBy: halting, head }),
      }),
    );
    expect(screen.getByText("Halted")).toBeInTheDocument();
    expect(fieldText()).toContain("#7003 and later jobs wait");
    expect(
      screen.getByText("Retry or delete this job to resume."),
    ).toBeInTheDocument();
  });

  test("points out an earlier job that also halts the sequence", async () => {
    const earlier = sequenceJob(6998n, JobState.Discarded);
    await renderField(
      { id: 7001n, state: JobState.Cancelled },
      status({
        halting: true,
        jobState: JobState.Cancelled,
        sequence: sequenceInspection({ haltedBy: earlier, head }),
      }),
    );
    expect(fieldText()).toContain("Earlier job #6998 also halts it.");
  });

  test("links other jobs to the next pending job", async () => {
    await renderField(
      { id: 6996n, state: JobState.Completed },
      status({
        jobState: JobState.Completed,
        sequence: sequenceInspection({ head }),
      }),
    );
    expect(fieldText()).toBe("Next pending: #7003");
  });

  test("says when nothing is pending", async () => {
    await renderField(
      { id: 6996n, state: JobState.Completed },
      status({ jobState: JobState.Completed }),
    );
    expect(fieldText()).toBe("No pending jobs");
  });

  test("shows loading and failed states", async () => {
    const { unmount } = await renderField(pendingJob, {
      error: false,
      key: sequenceKeyFixture,
    });
    expect(fieldText()).toBe("Loading…");
    unmount();

    await renderField(pendingJob, {
      error: true,
      jobSequence: jobSequence({ waitReason: "up_next" }),
      key: sequenceKeyFixture,
    });
    // A failed refresh doesn't present stale data.
    expect(fieldText()).toBe("Status unavailable");
  });
});

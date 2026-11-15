import type { JobSequenceStatus } from "@services/sequences";

import { JobState } from "@services/types";
import {
  jobSequence,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
} from "@test/factories/sequence";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import DeleteJobConfirmation from "./DeleteJobConfirmation";

const halting = sequenceJob(7001n, JobState.Cancelled);
const head = sequenceJob(7003n, JobState.Pending);

const haltingStatus = (
  overrides: Partial<JobSequenceStatus> = {},
  haltedBy = halting,
): JobSequenceStatus => ({
  error: false,
  jobSequence: jobSequence({
    halting: true,
    jobId: 7001n,
    jobState: JobState.Cancelled,
    sequence: sequenceInspection({
      haltedBy,
      head,
      pendingCount: { count: 2341, more: false },
    }),
  }),
  key: sequenceKeyFixture,
  ...overrides,
});

const renderDialog = (sequence?: JobSequenceStatus) => {
  const handlers = { onClose: vi.fn(), onDelete: vi.fn(), onRetry: vi.fn() };
  render(
    <DeleteJobConfirmation
      job={{ id: 7001n }}
      open
      sequence={sequence}
      {...handlers}
    />,
  );
  return handlers;
};

describe("DeleteJobConfirmation", () => {
  test("uses the plain confirmation for a job outside a sequence", () => {
    const { onDelete } = renderDialog();
    expect(screen.getByText("Delete job?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete job" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("uses the plain confirmation for a job that isn't halting", () => {
    renderDialog({
      error: false,
      jobSequence: jobSequence({ jobState: JobState.Completed }),
      key: sequenceKeyFixture,
    });
    expect(screen.getByText("Delete job?")).toBeInTheDocument();
  });

  test("uses the plain confirmation when the sequence failed to load", () => {
    renderDialog(haltingStatus({ error: true }));
    expect(screen.getByText("Delete job?")).toBeInTheDocument();
  });

  test("says how many jobs a halting job holds back and offers retry", () => {
    const { onDelete, onRetry } = renderDialog(haltingStatus());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Job 7001 halted its sequence");
    expect(dialog).toHaveTextContent(
      "2,341 pending jobs are waiting behind it, starting with #7003.",
    );
    expect(dialog).toHaveTextContent(
      "The 2,341 pending jobs start running right away, skipping it.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry instead" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete anyway" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("focuses retry so Enter doesn't delete", async () => {
    renderDialog(haltingStatus());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Retry instead" }),
      ).toHaveFocus();
    });
  });

  test("explains that an earlier halting job still holds the sequence", () => {
    renderDialog(haltingStatus({}, sequenceJob(6998n, JobState.Discarded)));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "The jobs behind it keep waiting on earlier job #6998, then run without this one.",
    );
  });
});

import { JobState } from "@services/types";
import {
  haltedSequenceFixture,
  sequenceInspection,
  sequenceJob,
  sequenceKeyFixture,
  sequenceListItem,
} from "@test/factories/sequence";
import { renderWithRouter } from "@test/utils/router";
import { visibleText } from "@test/utils/text";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import SequenceDetail, { type SequenceDetailProps } from "./SequenceDetail";

const renderPage = async (props: Partial<SequenceDetailProps> = {}) => {
  const handlers = {
    onJumpToJob: vi.fn(),
    onRemoveHalt: vi.fn(),
    onShowEarlier: vi.fn(),
    onShowLater: vi.fn(),
  };
  const result = await renderWithRouter(() => (
    <SequenceDetail
      hasEarlier={false}
      hasLater={false}
      inspection={haltedSequenceFixture.inspection}
      jobs={haltedSequenceFixture.jobs}
      sequenceKey={sequenceKeyFixture}
      {...handlers}
      {...props}
    />
  ));
  return { ...handlers, result };
};

const row = (id: bigint) => {
  const item = document.getElementById(`job-${id.toString()}`);
  if (!item) throw new Error(`Expected a row for job ${id.toString()}`);
  return item;
};

// fact reads a details grid field by its term.
const fact = (term: string) =>
  visibleText(screen.getByText(term, { selector: "dt" }).nextElementSibling);

describe("SequenceDetail", () => {
  test("titles the page by its jobs' kind, with a status and the key", async () => {
    await renderPage();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent(
      "update_order_status",
    );
    expect(within(header).getByText("Halted")).toBeInTheDocument();
    // The key is shortened on screen but kept whole for hover and copy.
    expect(within(header).getByTitle(sequenceKeyFixture)).toHaveTextContent(
      sequenceKeyFixture,
    );
    expect(
      within(header).getByRole("button", { name: "Copy sequence key" }),
    ).toBeInTheDocument();
  });

  test("falls back to a generic title for mixed kinds", async () => {
    await renderPage({
      inspection: sequenceInspection(),
      jobs: [
        sequenceListItem(6990n, JobState.Completed, 90, "placed"),
        sequenceListItem(6996n, JobState.Completed, 60, "paid"),
      ],
    });
    expect(
      within(screen.getByRole("banner")).getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Sequence");
  });

  test("details why the sequence is halted", async () => {
    await renderPage();
    expect(fact("Halted by")).toBe(
      "#7001 · CancelledRetry or delete it to resume.",
    );
    expect(fact("Next pending")).toBe("#7003");
    expect(fact("Pending")).toBe("2,341 jobs");
  });

  test("shows each job's state as a titled icon and what a held-back job did", async () => {
    await renderPage();
    expect(within(row(7001n)).getByTitle("Cancelled")).toBeInTheDocument();
    // The job holding the sequence back says what happened to it.
    expect(visibleText(row(7001n))).toContain(
      "Cancelled · halted the sequence",
    );
    expect(within(row(7003n)).getByTitle("Pending")).toBeInTheDocument();
    // Pending jobs get no third line: the details say which runs next and
    // what they wait on.
    expect(visibleText(row(7003n))).not.toContain("·");
    expect(
      within(row(7001n)).getByRole("link", { name: "#7001" }),
    ).toHaveAttribute("href", "/jobs/7001");
  });

  test("outlines the job the operator came from", async () => {
    await renderPage({ selectedJobId: 7010n });
    expect(row(7010n)).toHaveAttribute("aria-current", "true");
    // The outline is the only marker; the page has no "this" to name.
    expect(row(7010n)).toHaveClass("ring-2");
    expect(row(7003n)).not.toHaveAttribute("aria-current");
  });

  test("offers to show a selected job outside the loaded range", async () => {
    const { onJumpToJob } = await renderPage({ selectedJobId: 6912n });
    fireEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(onJumpToJob).toHaveBeenCalledWith(6912n);
  });

  test("retries the halting job in place", async () => {
    const { onRemoveHalt } = await renderPage();
    fireEvent.click(within(row(7001n)).getByRole("button", { name: "Retry" }));
    expect(onRemoveHalt).toHaveBeenCalledWith(7001n, "retry");
  });

  test("warns before deleting the halting job, and can retry instead", async () => {
    const { onRemoveHalt } = await renderPage();
    fireEvent.click(within(row(7001n)).getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "2,341 pending jobs are waiting behind it",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry instead" }));
    expect(onRemoveHalt).toHaveBeenCalledWith(7001n, "retry");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(within(row(7001n)).getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete anyway" }));
    expect(onRemoveHalt).toHaveBeenCalledWith(7001n, "delete");
  });

  test("sizes ID links to the longest ID so kinds line up", async () => {
    await renderPage({
      jobs: [
        sequenceListItem(99n, JobState.Completed, 60, "done"),
        sequenceListItem(100n, JobState.Pending, 30, "next"),
      ],
    });
    // Read the inline style: jsdom computes `ch` to pixels, which is what
    // toHaveStyle compares.
    for (const id of [99n, 100n]) {
      expect(
        within(row(id)).getByRole("link", { name: `#${id.toString()}` }).style
          .minWidth,
      ).toBe("4ch");
    }
  });

  test("pages toward earlier and later jobs", async () => {
    const { onShowEarlier, onShowLater } = await renderPage({
      hasEarlier: true,
      hasLater: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show earlier jobs" }));
    expect(onShowEarlier).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Show later jobs" }));
    expect(onShowLater).toHaveBeenCalledTimes(1);
  });

  test("hides paging past either end", async () => {
    await renderPage();
    expect(
      screen.queryByRole("button", { name: "Show earlier jobs" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show later jobs" }),
    ).not.toBeInTheDocument();
  });

  test("details a sequence waiting on a running job", async () => {
    await renderPage({
      inspection: sequenceInspection({
        blockers: [sequenceJob(7002n, JobState.Running)],
        head: sequenceJob(7003n, JobState.Pending),
        pendingCount: { count: 1, more: false },
      }),
      jobs: [
        sequenceListItem(7002n, JobState.Running, 2, "sent"),
        sequenceListItem(7003n, JobState.Pending, 30, "shipped"),
      ],
    });
    expect(screen.getByRole("banner")).toHaveTextContent("Waiting");
    expect(fact("Waiting on")).toBe("#7002 · Running");
    expect(fact("Pending")).toBe("1 job");
    expect(visibleText(row(7002n))).toContain(
      "Running · blocking the sequence",
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  test("details an idle sequence", async () => {
    await renderPage({
      inspection: sequenceInspection(),
      jobs: [sequenceListItem(7001n, JobState.Completed, 30, "done")],
    });
    expect(screen.getByRole("banner")).toHaveTextContent("Idle");
    expect(fact("Next pending")).toBe("–");
    expect(fact("Pending")).toBe("–");
    expect(screen.queryByText("Halted by")).not.toBeInTheDocument();
  });
});

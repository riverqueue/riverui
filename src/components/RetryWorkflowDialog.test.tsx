import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RetryWorkflowDialog from "./RetryWorkflowDialog";

describe("RetryWorkflowDialog", () => {
  it("renders title and disables confirm until a mode is selected", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog onClose={onClose} onConfirm={onConfirm} open />,
    );

    await waitFor(() => {
      expect(screen.getByText("Retry workflow")).toBeInTheDocument();
      const confirm = screen.getByRole("button", { name: /re-run jobs/i });
      expect(confirm).toBeDisabled();
    });
  });

  it("selects a mode and confirms with reset history off by default", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog onClose={onClose} onConfirm={onConfirm} open />,
    );

    fireEvent.click(screen.getByLabelText(/All jobs/i));
    const confirm = await waitFor(() => {
      const c = screen.getByRole("button", { name: /re-run jobs/i });
      expect(c).not.toBeDisabled();
      return c;
    });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("all", false);
  });

  it("passes reset history true when checked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog onClose={onClose} onConfirm={onConfirm} open />,
    );

    fireEvent.click(screen.getByLabelText(/Only failed jobs/i));
    fireEvent.click(screen.getByLabelText(/Reset history/i));
    fireEvent.click(screen.getByRole("button", { name: /re-run jobs/i }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("failed_only", true);
    });
  });

  it("initializes with default mode selected and confirm enabled", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog
        defaultMode="all"
        onClose={onClose}
        onConfirm={onConfirm}
        open
      />,
    );

    await waitFor(() => {
      const radio = screen.getByLabelText(/All jobs/i);
      expect(radio).toBeChecked();

      const confirm = screen.getByRole("button", { name: /re-run jobs/i });
      expect(confirm).not.toBeDisabled();
    });
  });

  it("initializes with default reset history checked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog
        defaultResetHistory
        onClose={onClose}
        onConfirm={onConfirm}
        open
      />,
    );

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/Reset history/i);
      expect(checkbox).toBeChecked();
    });
  });

  it("disables confirm when pending even if mode selected", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog
        defaultMode="all"
        onClose={onClose}
        onConfirm={onConfirm}
        open
        pending
      />,
    );

    await waitFor(() => {
      const confirm = screen.getByRole("button", { name: /re-run jobs/i });
      expect(confirm).toBeDisabled();
    });
  });

  it("calls onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog onClose={onClose} onConfirm={onConfirm} open />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders nothing when not open", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <RetryWorkflowDialog
        onClose={onClose}
        onConfirm={onConfirm}
        open={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("resets state when dialog closes and reopens", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <RetryWorkflowDialog
        defaultMode="all"
        defaultResetHistory={false}
        onClose={onClose}
        onConfirm={onConfirm}
        open
      />,
    );

    // Change state
    fireEvent.click(screen.getByLabelText(/Only failed jobs/i));
    fireEvent.click(screen.getByLabelText(/Reset history/i));

    // Close
    rerender(
      <RetryWorkflowDialog
        defaultMode="all"
        defaultResetHistory={false}
        onClose={onClose}
        onConfirm={onConfirm}
        open={false}
      />,
    );

    // Reopen
    rerender(
      <RetryWorkflowDialog
        defaultMode="all"
        defaultResetHistory={false}
        onClose={onClose}
        onConfirm={onConfirm}
        open
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/All jobs/i)).toBeChecked();
      expect(screen.getByLabelText(/Only failed jobs/i)).not.toBeChecked();
      expect(screen.getByLabelText(/Reset history/i)).not.toBeChecked();
    });
  });

  it("selects failed and downstream mode and confirms", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryWorkflowDialog onClose={onClose} onConfirm={onConfirm} open />,
    );

    fireEvent.click(screen.getByLabelText(/Failed jobs \+ dependents/i));
    fireEvent.click(screen.getByRole("button", { name: /re-run jobs/i }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("failed_and_downstream", false);
    });
  });
});

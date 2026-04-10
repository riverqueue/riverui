import { jobFactory } from "@test/factories/job";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { expect, test, vi } from "vitest";

import JobDetail from "./JobDetail";

test("requires confirmation before deleting a job", async () => {
  const job = jobFactory.completed().build({ id: 123n });
  const deleteFn = vi.fn();
  const user = userEvent.setup();

  render(
    <JobDetail
      cancel={vi.fn()}
      deleteFn={deleteFn}
      job={job}
      retry={vi.fn()}
    />,
  );

  await act(async () => {
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
  });

  expect(deleteFn).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("dialog", { name: "Delete job?" });
  expect(
    within(dialog).getByText(/This permanently deletes job/i),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("123")).toBeInTheDocument();

  await act(async () => {
    await user.click(
      within(dialog).getByRole("button", { name: /delete job/i }),
    );
  });

  await waitFor(() => {
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("dialog", { name: "Delete job?" }),
    ).not.toBeInTheDocument();
  });
});

test("cancels job delete confirmation", async () => {
  const job = jobFactory.completed().build();
  const deleteFn = vi.fn();
  const user = userEvent.setup();

  render(
    <JobDetail
      cancel={vi.fn()}
      deleteFn={deleteFn}
      job={job}
      retry={vi.fn()}
    />,
  );

  await act(async () => {
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
  });
  const dialog = await screen.findByRole("dialog", { name: "Delete job?" });
  await act(async () => {
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
  });

  await waitFor(() => {
    expect(deleteFn).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Delete job?" }),
    ).not.toBeInTheDocument();
  });
});

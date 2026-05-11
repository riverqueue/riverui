import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WorkflowListEmptyState from "./WorkflowListEmptyState";

describe("WorkflowListEmptyState", () => {
  it("shows migration guidance when workflow tables are unavailable", () => {
    render(<WorkflowListEmptyState workflowQueriesEnabled={false} />);

    expect(
      screen.getByRole("heading", { name: "Build faster with Workflows" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/run all River Pro migrations/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No workflows yet" }),
    ).not.toBeInTheDocument();
  });

  it("shows a neutral empty state when workflow tables are available", () => {
    render(<WorkflowListEmptyState workflowQueriesEnabled />);

    expect(
      screen.getByRole("heading", { name: "No workflows yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/coordinate fan-out, fan-in, retries/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://riverqueue.com/docs/pro/workflows",
    );
    expect(
      screen.queryByRole("heading", {
        name: "Build faster with Workflows",
      }),
    ).not.toBeInTheDocument();
  });
});

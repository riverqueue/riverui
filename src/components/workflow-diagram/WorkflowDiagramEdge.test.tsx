import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { switchHandleCenterGap } from "./workflowDiagramConstants";
import WorkflowDiagramEdge, {
  type WorkflowDiagramEdgeProps,
} from "./WorkflowDiagramEdge";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path }: { path: string }) => (
    <div data-path={path} data-testid="base-edge" />
  ),
}));

describe("WorkflowDiagramEdge", () => {
  it("terminates at the gate hinge when a target anchor offset is provided", () => {
    const props: WorkflowDiagramEdgeProps = {
      data: {
        preferredBendX: 248,
        targetAnchorOffsetX: -switchHandleCenterGap,
      },
      sourceX: 100,
      sourceY: 20,
      targetX: 300,
      targetY: 140,
    };

    render(<WorkflowDiagramEdge {...props} />);

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-path",
      "M 100,20 L 248,20 L 248,140 L 268,140",
    );
  });
});

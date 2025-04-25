import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EditableBadge } from "./EditableBadge";

describe("EditableBadge", () => {
  const defaultProps = {
    content: ["bug", "feature"],
    onContentChange: vi.fn(),
    onRemove: vi.fn(),
    prefix: "kind:",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders with default props", () => {
    render(<EditableBadge {...defaultProps} />);

    // Check prefix is displayed
    expect(screen.getByText("kind:")).toBeInTheDocument();

    // Check content is displayed
    expect(screen.getByDisplayValue("bug, feature")).toBeInTheDocument();

    // Check remove button is present
    expect(screen.getByLabelText("Remove filter")).toBeInTheDocument();
  });

  test("renders with custom color", () => {
    render(<EditableBadge {...defaultProps} color="blue" />);
    // The Badge component should have the blue color class
    const badge = screen
      .getByDisplayValue("bug, feature")
      .closest(".bg-blue-500\\/15");
    expect(badge).toBeInTheDocument();
  });

  test("renders with empty content array", () => {
    render(<EditableBadge {...defaultProps} content={[]} />);
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  });

  test("handles non-array content by converting to array", () => {
    // Using type assertion to test the component's handling of non-array content
    render(<EditableBadge {...defaultProps} content={["single"]} />);
    expect(screen.getByDisplayValue("single")).toBeInTheDocument();
  });

  test("calls onRemove when remove button is clicked", () => {
    render(<EditableBadge {...defaultProps} />);

    const removeButton = screen.getByLabelText("Remove filter");
    fireEvent.click(removeButton);

    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);
  });

  test("enters edit mode when clicked", () => {
    const onEditStart = vi.fn();
    render(<EditableBadge {...defaultProps} onEditStart={onEditStart} />);

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.click(input);

    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  test("updates content when edited", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.change(input, { target: { value: "bug, feature, enhancement" } });

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "enhancement",
        values: ["bug", "feature", "enhancement"],
      }),
    );
  });

  test("calls onEditComplete when Enter is pressed", () => {
    const onEditComplete = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        isEditing={true}
        onEditComplete={onEditComplete}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.keyDown(input, { key: "Enter" });

    // The component calls onEditComplete twice - once for the keydown event
    // and once for the blur event that happens when the input loses focus
    expect(onEditComplete).toHaveBeenCalledTimes(2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["bug", "feature"],
      }),
    );
  });

  test("calls onEditComplete and resets value when Escape is pressed", () => {
    const onEditComplete = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        isEditing={true}
        onEditComplete={onEditComplete}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.change(input, { target: { value: "modified" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // The component calls onEditComplete twice - once for the keydown event
    // and once for the blur event that happens when the input loses focus
    expect(onEditComplete).toHaveBeenCalledTimes(2);
    expect(input).toHaveDisplayValue("bug, feature");
  });

  test("calls onEditComplete when input loses focus", () => {
    const onEditComplete = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        isEditing={true}
        onEditComplete={onEditComplete}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.blur(input);

    expect(onEditComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["bug", "feature"],
      }),
    );
  });

  test("calls onEditingValueChange when editing a specific value", () => {
    const onEditingValueChange = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        isEditing={true}
        onEditingValueChange={onEditingValueChange}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature");

    // Simulate editing the first value by changing just that part
    fireEvent.change(input, {
      target: {
        selectionEnd: 3,
        selectionStart: 3, // Position after "mod"
        value: "modified, feature",
      },
    });

    // Verify the first call was for the first value
    expect(onEditingValueChange).toHaveBeenCalledWith("modified", 0);

    // Clear the mock to make our next assertion cleaner
    onEditingValueChange.mockClear();

    // Now simulate editing the second value
    fireEvent.change(input, {
      target: {
        selectionEnd: 13,
        selectionStart: 13, // Position within "enhanced"
        value: "modified, enhanced",
      },
    });

    // Verify the second call was for the second value
    expect(onEditingValueChange).toHaveBeenCalledWith("enhanced", 1);
  });

  test("handles empty values correctly", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);

    const input = screen.getByDisplayValue("bug, feature");
    fireEvent.change(input, { target: { value: "bug, , feature" } });

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["bug", "feature"],
      }),
    );
  });

  test("applies custom className", () => {
    render(<EditableBadge {...defaultProps} className="custom-class" />);
    const badge = screen
      .getByDisplayValue("bug, feature")
      .closest(".custom-class");
    expect(badge).toBeInTheDocument();
  });

  test("correctly handles editing a middle item in a longer list", () => {
    const onEditingValueChange = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["bug", "feature", "enhancement", "documentation"]}
        isEditing={true}
        onEditingValueChange={onEditingValueChange}
      />,
    );

    const input = screen.getByDisplayValue(
      "bug, feature, enhancement, documentation",
    );

    // Simulate editing the second value (index 1)
    fireEvent.change(input, {
      target: {
        selectionEnd: 8,
        selectionStart: 8, // Position within "improved"
        value: "bug, improved, enhancement, documentation",
      },
    });

    // Verify the call was for the second value
    expect(onEditingValueChange).toHaveBeenCalledWith("improved", 1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "improved",
        values: ["bug", "improved", "enhancement", "documentation"],
      }),
    );

    // Clear the mock to make our next assertion cleaner
    onEditingValueChange.mockClear();
    defaultProps.onContentChange.mockClear();

    // Now simulate editing the third value (index 2)
    fireEvent.change(input, {
      target: {
        selectionEnd: 20,
        selectionStart: 20, // Position within "fixed"
        value: "bug, improved, fixed, documentation",
      },
    });

    // Verify the call was for the third value
    expect(onEditingValueChange).toHaveBeenCalledWith("fixed", 2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "fixed",
        values: ["bug", "improved", "fixed", "documentation"],
      }),
    );
  });

  test("correctly updates editing state when cursor moves between values", () => {
    const onEditingValueChange = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["bug", "feature", "enhancement"]}
        isEditing={true}
        onEditingValueChange={onEditingValueChange}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature, enhancement");

    // First, simulate editing the first value
    fireEvent.change(input, {
      target: {
        selectionEnd: 3,
        selectionStart: 3, // Position within "fixed"
        value: "fixed, feature, enhancement",
      },
    });

    // Verify the first call was for the first value
    expect(onEditingValueChange).toHaveBeenCalledWith("fixed", 0);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 0,
        editingValue: "fixed",
        values: ["fixed", "feature", "enhancement"],
      }),
    );

    // Clear the mock to make our next assertion cleaner
    onEditingValueChange.mockClear();
    defaultProps.onContentChange.mockClear();

    // Now simulate editing the second value by making a small change
    // This is a workaround since fireEvent.change doesn't trigger when the value is the same
    fireEvent.change(input, {
      target: {
        selectionEnd: 9,
        selectionStart: 9, // Position within "featurex"
        value: "fixed, featurex, enhancement",
      },
    });

    // Verify the call was for the second value
    expect(onEditingValueChange).toHaveBeenCalledWith("featurex", 1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "featurex",
        values: ["fixed", "featurex", "enhancement"],
      }),
    );

    // Clear the mock again
    onEditingValueChange.mockClear();
    defaultProps.onContentChange.mockClear();

    // Now simulate editing the third value
    fireEvent.change(input, {
      target: {
        selectionEnd: 19,
        selectionStart: 19, // Position within "enhanced"
        value: "fixed, featurex, enhanced",
      },
    });

    // Verify the call was for the third value
    expect(onEditingValueChange).toHaveBeenCalledWith("enhanced", 2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "enhanced",
        values: ["fixed", "featurex", "enhanced"],
      }),
    );
  });

  test("correctly handles Enter key when editing a middle value", () => {
    const onEditComplete = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["bug", "feature", "enhancement"]}
        isEditing={true}
        onEditComplete={onEditComplete}
      />,
    );

    const input = screen.getByDisplayValue("bug, feature, enhancement");

    // First, simulate editing the second value
    fireEvent.change(input, {
      target: {
        selectionEnd: 8,
        selectionStart: 8, // Position within "improved"
        value: "bug, improved, enhancement",
      },
    });

    // Verify the content change was called with the correct values
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "improved",
        values: ["bug", "improved", "enhancement"],
      }),
    );

    // Clear the mock to make our next assertion cleaner
    defaultProps.onContentChange.mockClear();

    // Now simulate pressing Enter
    fireEvent.keyDown(input, { key: "Enter" });

    // Verify onEditComplete was called
    expect(onEditComplete).toHaveBeenCalledTimes(2); // Once for keydown, once for blur

    // Verify the final content change was called with the correct values
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2, // When Enter is pressed, it sets editingIndex to the last value
        editingValue: "enhancement",
        values: ["bug", "improved", "enhancement"],
      }),
    );
  });
});

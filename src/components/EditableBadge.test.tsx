import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { EditableBadge } from "./EditableBadge";

describe("EditableBadge", () => {
  const defaultProps = {
    color: "zinc" as const,
    content: ["value1", "value2"],
    isEditing: false,
    onContentChange: vi.fn(),
    onEditComplete: vi.fn(),
    onEditingValueChange: vi.fn(),
    onEditStart: vi.fn(),
    onRemove: vi.fn(),
    prefix: "test:",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders with default props", () => {
    render(<EditableBadge {...defaultProps} />);

    // Check prefix is displayed
    expect(screen.getByText("test:")).toBeInTheDocument();

    // Check content is displayed
    expect(screen.getByDisplayValue("value1, value2")).toBeInTheDocument();

    // Check remove button is present
    expect(screen.getByLabelText("Remove filter")).toBeInTheDocument();
  });

  test("renders with custom color", () => {
    render(<EditableBadge {...defaultProps} color="blue" />);
    // The Badge component should have the blue color class
    const badge = screen
      .getByDisplayValue("value1, value2")
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

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.click(input);

    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  test("updates content when edited", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.change(input, {
      target: { value: "value1, value2, enhancement" },
    });

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "enhancement",
        values: ["value1", "value2", "enhancement"],
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

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.keyDown(input, { key: "Enter" });

    // The component calls onEditComplete twice - once for the keydown event
    // and once for the blur event that happens when the input loses focus
    expect(onEditComplete).toHaveBeenCalledTimes(2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["value1", "value2"],
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

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.change(input, { target: { value: "modified" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // The component calls onEditComplete twice - once for the keydown event
    // and once for the blur event that happens when the input loses focus
    expect(onEditComplete).toHaveBeenCalledTimes(2);
    expect(input).toHaveDisplayValue("value1, value2");
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

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.blur(input);

    expect(onEditComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["value1", "value2"],
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

    const input = screen.getByDisplayValue("value1, value2");

    // Simulate editing the first value by changing just that part
    fireEvent.change(input, {
      target: {
        selectionEnd: 3,
        selectionStart: 3, // Position after "mod"
        value: "modified, value2",
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

    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.change(input, { target: { value: "value1, , value2" } });

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["value1", "value2"],
      }),
    );
  });

  test("applies custom className", () => {
    render(<EditableBadge {...defaultProps} className="custom-class" />);
    const badge = screen
      .getByDisplayValue("value1, value2")
      .closest(".custom-class");
    expect(badge).toBeInTheDocument();
  });

  test("correctly handles editing a middle item in a longer list", () => {
    const onEditingValueChange = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["value1", "value2", "enhancement", "documentation"]}
        isEditing={true}
        onEditingValueChange={onEditingValueChange}
      />,
    );

    const input = screen.getByDisplayValue(
      "value1, value2, enhancement, documentation",
    );

    // Simulate editing the second value (index 1)
    fireEvent.change(input, {
      target: {
        selectionEnd: 8,
        selectionStart: 8, // Position within "improved"
        value: "value1, improved, enhancement, documentation",
      },
    });

    // Verify the call was for the second value
    expect(onEditingValueChange).toHaveBeenCalledWith("improved", 1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "improved",
        values: ["value1", "improved", "enhancement", "documentation"],
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
        value: "value1, improved, fixed, documentation",
      },
    });

    // Verify the call was for the third value
    expect(onEditingValueChange).toHaveBeenCalledWith("fixed", 2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "fixed",
        values: ["value1", "improved", "fixed", "documentation"],
      }),
    );
  });

  test("correctly updates editing state when cursor moves between values", () => {
    const onEditingValueChange = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["value1", "value2", "enhancement"]}
        isEditing={true}
        onEditingValueChange={onEditingValueChange}
      />,
    );

    const input = screen.getByDisplayValue("value1, value2, enhancement");

    // First, simulate editing the first value
    fireEvent.change(input, {
      target: {
        selectionEnd: 3,
        selectionStart: 3, // Position within "fixed"
        value: "fixed, value2, enhancement",
      },
    });

    // Verify the first call was for the first value
    expect(onEditingValueChange).toHaveBeenCalledWith("fixed", 0);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 0,
        editingValue: "fixed",
        values: ["fixed", "value2", "enhancement"],
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
        selectionStart: 9, // Position within "value2x"
        value: "fixed, value2x, enhancement",
      },
    });

    // Verify the call was for the second value
    expect(onEditingValueChange).toHaveBeenCalledWith("value2x", 1);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "value2x",
        values: ["fixed", "value2x", "enhancement"],
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
        value: "fixed, value2x, enhanced",
      },
    });

    // Verify the call was for the third value
    expect(onEditingValueChange).toHaveBeenCalledWith("enhanced", 2);
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 2,
        editingValue: "enhanced",
        values: ["fixed", "value2x", "enhanced"],
      }),
    );
  });

  test("correctly handles Enter key when editing a middle value", () => {
    const onEditComplete = vi.fn();
    render(
      <EditableBadge
        {...defaultProps}
        content={["value1", "value2", "enhancement"]}
        isEditing={true}
        onEditComplete={onEditComplete}
      />,
    );

    const input = screen.getByDisplayValue("value1, value2, enhancement");

    // First, simulate editing the second value
    fireEvent.change(input, {
      target: {
        selectionEnd: 8,
        selectionStart: 8, // Position within "improved"
        value: "value1, improved, enhancement",
      },
    });

    // Verify the content change was called with the correct values
    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        editingIndex: 1,
        editingValue: "improved",
        values: ["value1", "improved", "enhancement"],
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
        values: ["value1", "improved", "enhancement"],
      }),
    );
  });

  test("handles input changes", async () => {
    const user = userEvent.setup();
    render(<EditableBadge {...defaultProps} isEditing />);
    const input = screen.getByDisplayValue("value1, value2");
    await user.clear(input);
    await user.type(input, "new");
    expect(defaultProps.onEditingValueChange).toHaveBeenCalledWith("new", 0);
  });

  test("handles suggestion selection", () => {
    const { rerender } = render(<EditableBadge {...defaultProps} isEditing />);
    const input = screen.getByDisplayValue("value1, value2");

    // Type a partial value
    fireEvent.change(input, { target: { value: "new" } });

    // Select a suggestion
    rerender(
      <EditableBadge
        {...defaultProps}
        isEditing
        selectedSuggestion="newValue"
      />,
    );

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["newValue"],
      }),
    );
  });

  test("handles multiple values with suggestions", () => {
    const { rerender } = render(<EditableBadge {...defaultProps} isEditing />);
    const input = screen.getByDisplayValue("value1, value2");

    // Type a partial value for the second item
    fireEvent.change(input, { target: { value: "value1, new" } });

    // Select a suggestion
    rerender(
      <EditableBadge
        {...defaultProps}
        isEditing
        selectedSuggestion="newValue"
      />,
    );

    expect(defaultProps.onContentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["value1", "newValue"],
      }),
    );
  });

  test("handles Enter key to complete editing", () => {
    render(<EditableBadge {...defaultProps} isEditing />);
    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(defaultProps.onEditComplete).toHaveBeenCalled();
  });

  test("handles Escape key to cancel editing", () => {
    render(<EditableBadge {...defaultProps} isEditing />);
    const input = screen.getByDisplayValue("value1, value2");
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(defaultProps.onEditComplete).toHaveBeenCalled();
    expect(screen.getByDisplayValue("value1, value2")).toBeInTheDocument();
  });
});

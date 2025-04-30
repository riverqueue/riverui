import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EditableBadge } from "./EditableBadge";

describe("EditableBadge", () => {
  const onEditStart = vi.fn();
  const onEditComplete = vi.fn();
  const onRawValueChange = vi.fn();
  const onSuggestionKeyDown = vi.fn();
  const onRemove = vi.fn();

  const defaultProps = {
    color: "zinc" as const,
    content: ["value1", "value2"],
    editing: {
      onComplete: onEditComplete,
      onStart: onEditStart,
    },
    isEditing: false,
    onContentChange: vi.fn(), // Still needed by type, mock it
    onRawValueChange: onRawValueChange,
    onRemove: onRemove,
    prefix: "test:",
    rawEditValue: "value1,value2,", // Typical value when editing
    suggestions: {
      onKeyDown: onSuggestionKeyDown,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering Tests --- //

  test("renders prefix and display value when not editing", () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    expect(screen.getByText("test:")).toBeInTheDocument();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("value1,value2"); // Joined content
    expect(input.disabled).toBe(false);
  });

  test("renders prefix and rawEditValue when editing", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    expect(screen.getByText("test:")).toBeInTheDocument();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("value1,value2,"); // rawEditValue
    expect(input.disabled).toBe(false);
  });

  test("renders with empty content correctly", () => {
    render(
      <EditableBadge
        {...defaultProps}
        content={[]}
        isEditing={false}
        rawEditValue=""
      />,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
    // Should be disabled if empty and not editing
    // expect(input.disabled).toBe(true); // Test this explicitly if needed
  });

  test("applies custom className and color", () => {
    render(
      <EditableBadge {...defaultProps} className="custom-class" color="blue" />,
    );
    const badge = screen
      .getByText("test:")
      .closest(".custom-class.bg-blue-500\\/15");
    expect(badge).toBeInTheDocument();
  });

  test("input has min width for clickability", () => {
    render(<EditableBadge {...defaultProps} content={[]} rawEditValue="" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("min-w-[2ch]");
  });

  test("shows title attribute when not editing", () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("title", "value1,value2");
  });

  test("does not show title attribute when editing", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("title");
  });

  test("renders correct aria-labels", () => {
    render(<EditableBadge {...defaultProps} />);
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-label",
      "Filter values for test:",
    );
    expect(
      screen.getByRole("button", { name: /Remove filter/ }),
    ).toHaveAttribute("aria-label", "Remove filter test:");
  });

  // --- Interaction Tests --- //

  test("calls onRemove when remove button is clicked", () => {
    render(<EditableBadge {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("calls onEditStart when badge area clicked (not editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    const badge = screen.getByText("test:").parentElement as HTMLElement;
    fireEvent.click(badge);
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  test("does not call onEditStart when badge area clicked (already editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const badge = screen.getByText("test:").parentElement as HTMLElement;
    fireEvent.click(badge);
    expect(onEditStart).not.toHaveBeenCalled();
  });

  test("calls onEditStart when input clicked (not editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    fireEvent.click(screen.getByRole("textbox"));
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  test("calls onEditStart when input focused (not editing)", async () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    await act(async () => {
      screen.getByRole("textbox").focus();
    });
    expect(onEditStart).toHaveBeenCalled();
  });

  test("calls onRawValueChange with value and cursor pos on input change (editing)", async () => {
    const user = userEvent.setup();
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "A");
    // Input value changes, cursor moves
    expect(onRawValueChange).toHaveBeenLastCalledWith("value1,value2,A", 15); // rawEditValue + A - Adjusted cursor pos
  });

  test("does not call onRawValueChange on input change (not editing)", async () => {
    // Input should technically be read-only or handled differently when not editing,
    // but testing the callback guard
    const user = userEvent.setup();
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "A");
    expect(onRawValueChange).not.toHaveBeenCalled();
  });

  test("calls suggestions.onKeyDown on key down (editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onSuggestionKeyDown).toHaveBeenCalledTimes(1);
    expect(onSuggestionKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ArrowDown" }),
    );
  });

  test("calls onEditComplete on Enter key (editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEditComplete).toHaveBeenCalledTimes(1);
  });

  test("calls onEditComplete on Escape key (editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onEditComplete).toHaveBeenCalledTimes(1);
  });

  test("calls onEditComplete on blur (editing)", async () => {
    // Need timers for the setTimeout in onBlur
    vi.useFakeTimers();
    render(<EditableBadge {...defaultProps} isEditing={true} />);
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);

    // Advance timers past the 100ms delay
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(onEditComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("does not call callbacks on key down / blur (not editing)", () => {
    render(<EditableBadge {...defaultProps} isEditing={false} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(onSuggestionKeyDown).not.toHaveBeenCalled();
    expect(onEditComplete).not.toHaveBeenCalled();
  });

  test("input is focused when isEditing becomes true", () => {
    const { rerender } = render(
      <EditableBadge {...defaultProps} isEditing={false} />,
    );
    const input = screen.getByRole("textbox");
    expect(document.activeElement).not.toBe(input);

    rerender(<EditableBadge {...defaultProps} isEditing={true} />);
    // Focus happens in useEffect, might need short wait or act
    // Using a simple check here, refine if flaky
    expect(document.activeElement).toBe(input);
  });
});

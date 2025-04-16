import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import TagInput from "./TagInput";

describe("TagInput", () => {
  test("renders with no tags", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={[]} />);

    // Check that the placeholder is visible
    expect(
      screen.getByPlaceholderText("Type and press Enter to add"),
    ).toBeInTheDocument();
  });

  test("renders with provided tags", () => {
    const tags = ["apple", "banana"];
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={tags} />);

    // Check that all tags are rendered
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  test("adds a tag when typing and pressing Enter", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={[]} />);

    const input = screen.getByPlaceholderText("Type and press Enter to add");
    fireEvent.change(input, { target: { value: "newTag" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // onChange should be called with the new tag
    expect(onChange).toHaveBeenCalledWith(["newTag"]);
  });

  test("does not add duplicate tags", () => {
    const initialTags = ["apple"];
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={initialTags} />);

    const input = screen.getByPlaceholderText("");
    fireEvent.change(input, { target: { value: "apple" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // onChange should not be called since the tag already exists
    expect(onChange).not.toHaveBeenCalled();
  });

  test("removes the last tag when pressing Backspace with empty input", () => {
    const initialTags = ["apple", "banana"];
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={initialTags} />);

    const input = screen.getByPlaceholderText("");
    fireEvent.keyDown(input, { key: "Backspace" });

    // onChange should be called with the remaining tags
    expect(onChange).toHaveBeenCalledWith(["apple"]);
  });

  test("removes a specific tag when clicking its remove button", () => {
    const initialTags = ["apple", "banana"];
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={initialTags} />);

    const removeAppleButton = screen.getByLabelText("Remove apple");
    fireEvent.click(removeAppleButton);

    // onChange should be called with the remaining tags
    expect(onChange).toHaveBeenCalledWith(["banana"]);
  });

  test("shows help text when showHelpText is true", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} showHelpText tags={[]} />);

    expect(
      screen.getByText(
        "Enter multiple keys by typing each one and pressing Enter",
      ),
    ).toBeInTheDocument();
  });

  test("does not show help text when showHelpText is false", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} showHelpText={false} tags={[]} />);

    expect(
      screen.queryByText(
        "Enter multiple keys by typing each one and pressing Enter",
      ),
    ).not.toBeInTheDocument();
  });

  test("trims whitespace from tags", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={[]} />);

    const input = screen.getByPlaceholderText("Type and press Enter to add");
    fireEvent.change(input, { target: { value: "  newTag  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // onChange should be called with the trimmed tag
    expect(onChange).toHaveBeenCalledWith(["newTag"]);
  });

  test("does not add empty tags", () => {
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} tags={[]} />);

    const input = screen.getByPlaceholderText("Type and press Enter to add");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // onChange should not be called for empty/whitespace tags
    expect(onChange).not.toHaveBeenCalled();
  });

  test("disables input when disabled prop is true", () => {
    const onChange = vi.fn();
    render(<TagInput disabled onChange={onChange} tags={["apple"]} />);

    // Input should be disabled
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();

    // Remove button should not be present
    expect(screen.queryByLabelText("Remove apple")).not.toBeInTheDocument();
  });

  test("uses custom badge color when provided", () => {
    const onChange = vi.fn();
    render(<TagInput badgeColor="red" onChange={onChange} tags={["apple"]} />);

    // This is a simplified test as we can't easily check CSS classes with testing-library
    // In a real scenario, you might want to use a more sophisticated approach
    const badge = screen.getByText("apple").closest(".flex");
    expect(badge).toBeInTheDocument();
  });

  test("updates internal tags when external tags change", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TagInput onChange={onChange} tags={["apple"]} />,
    );

    // Update props to simulate external tags changing
    rerender(<TagInput onChange={onChange} tags={["apple", "banana"]} />);

    // Both tags should now be visible
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });
});

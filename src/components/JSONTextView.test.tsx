import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JSONTextView from "./JSONTextView";

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

vi.mock("react-hot-toast", () => ({
  default: {
    custom: vi.fn(),
  },
}));

describe("JSONTextView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders and copies sorted JSON without rounding large numbers", async () => {
    const rawJSON = '{"z":2,"id":1970670598291982290,"a":1}';
    const formattedJSON = `{
  "a": 1,
  "id": 1970670598291982290,
  "z": 2
}`;

    render(<JSONTextView copyTitle="Args" text={rawJSON} />);

    expect(screen.getByText(/1970670598291982290/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("text-copy-button"));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(formattedJSON);

    await waitFor(() => {
      expect(toast.custom).toHaveBeenCalled();
    });
  });

  it("keeps nested args collapsible while copying the complete value", async () => {
    const rawJSON =
      '{"z":2,"outer":{"nested":{"id":1970670598291982290}},"a":1}';

    render(<JSONTextView copyTitle="Args" text={rawJSON} />);

    expect(screen.queryByText("1970670598291982290")).not.toBeInTheDocument();

    const outerButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes('"outer"'));
    expect(outerButton).toBeDefined();
    fireEvent.click(outerButton!);

    const nestedButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes('"nested"'));
    expect(nestedButton).toBeDefined();
    fireEvent.click(nestedButton!);

    expect(screen.getByText("1970670598291982290")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("text-copy-button"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`{
  "a": 1,
  "outer": {
    "nested": {
      "id": 1970670598291982290
    }
  },
  "z": 2
}`);
  });

  it("uses the same sorted order for displayed and copied integer keys", async () => {
    render(<JSONTextView text='{"10":"ten","a":0,"2":"two"}' />);

    const twoKey = screen.getByText('"2"');
    const tenKey = screen.getByText('"10"');
    expect(
      twoKey.compareDocumentPosition(tenKey) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("text-copy-button"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`{
  "2": "two",
  "10": "ten",
  "a": 0
}`);
  });

  it("renders malformed or excessively nested args as literal text", () => {
    const deeplyNested = `${"[".repeat(5_000)}0${"]".repeat(5_000)}`;
    const { rerender } = render(<JSONTextView text="{not valid" />);

    expect(screen.getByText("{not valid")).toBeInTheDocument();

    rerender(<JSONTextView text={deeplyNested} />);
    expect(screen.getByText(deeplyNested)).toBeInTheDocument();
  });
});

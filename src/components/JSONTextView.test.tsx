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
});

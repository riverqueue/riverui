import { act, fireEvent, render, screen } from "@testing-library/react";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlaintextPanel from "./PlaintextPanel";

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

describe("PlaintextPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders text in preformatted code markup", () => {
    const text = [
      "time=2026-06-11T19:03:14Z level=info msg=starting",
      "  indented continuation",
      "time=2026-06-11T19:03:15Z level=info msg=finished",
    ].join("\n");

    const { container } = render(<PlaintextPanel text={text} />);

    const pre = container.querySelector("pre");
    const code = pre?.querySelector("code");

    expect(pre).toBeInTheDocument();
    expect(pre).toHaveClass("whitespace-pre");
    expect(code?.textContent).toBe(text);
  });

  it("copies the original text", async () => {
    const text = "first line\nsecond line";

    render(<PlaintextPanel copyTitle="Log Entry" text={text} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("text-copy-button"));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
    expect(toast.custom).toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Badge, BadgeButton } from "../components/Badge";

vi.mock("@tanstack/react-router", () => {
  return {
    Link: ({
      children,
      className,
      href,
    }: {
      children: React.ReactNode;
      className: string;
      href: string;
    }) => (
      <a className={className} href={href}>
        {children}
      </a>
    ),
  };
});

describe("Badge", () => {
  test("renders with default props", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  test("renders with custom color", () => {
    render(<Badge color="blue">Blue Badge</Badge>);
    expect(screen.getByText("Blue Badge")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    render(<Badge className="custom-class">Custom Badge</Badge>);
    expect(screen.getByText("Custom Badge")).toHaveClass("custom-class");
  });
});

describe("BadgeButton", () => {
  test("renders as a button by default", () => {
    render(<BadgeButton>Test Button</BadgeButton>);
    expect(screen.getByText("Test Button")).toBeInTheDocument();
  });

  test("renders as a link when href is provided", () => {
    render(<BadgeButton href="/test">Test Link</BadgeButton>);
    const link = screen.getByText("Test Link").closest("a");
    expect(link).toHaveAttribute("href", "/test");
  });

  test("renders with custom color", () => {
    render(<BadgeButton color="red">Red Button</BadgeButton>);
    expect(screen.getByText("Red Button")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    render(<BadgeButton className="custom-class">Custom Button</BadgeButton>);
    const wrapper = screen.getByText("Custom Button").closest("button");
    expect(wrapper).toHaveClass("custom-class");
  });
});

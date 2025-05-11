import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JSONView from "./JSONView";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    custom: vi.fn(),
  },
}));

describe("JSONView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const simpleData = {
    age: 30,
    isActive: true,
    name: "John Doe",
  };

  const nestedData = {
    items: ["apple", "banana", "cherry"],
    person: {
      contact: {
        email: "jane@example.com",
        phone: "555-5678",
      },
      name: "Jane Smith",
    },
  };

  it("renders simple JSON data", () => {
    render(<JSONView data={simpleData} />);

    // Check that key elements are in the document
    expect(screen.getByText(/"name"/)).toBeInTheDocument();
    expect(screen.getByText(/"John Doe"/)).toBeInTheDocument();
    expect(screen.getByText(/"age"/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/"isActive"/)).toBeInTheDocument();
    expect(screen.getByText(/true/)).toBeInTheDocument();
  });

  it("renders nested JSON data with collapsed nodes but visible keys by default", () => {
    render(<JSONView data={nestedData} defaultExpandDepth={1} />);

    // The root node should be initially expanded since defaultExpandDepth=1
    expect(screen.getByText(/person/i, { exact: false })).toBeInTheDocument();

    // Find the element containing "items" that's also near ":"
    const itemsElements = screen.getAllByText(/items/i);
    const itemsKeyElement = itemsElements.find((el) =>
      el.nextSibling?.textContent?.includes(":"),
    );
    expect(itemsKeyElement).toBeDefined();

    // Child nodes of person should be visible when expanded
    const personButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("person"));

    expect(personButton).toBeDefined();
    if (personButton) {
      fireEvent.click(personButton);

      // Now the name should be visible
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/contact/i)).toBeInTheDocument();
    }
  });

  it("renders nested JSON data with all nodes collapsed when defaultExpandDepth is 0", () => {
    render(<JSONView data={nestedData} defaultExpandDepth={0} />);

    // When defaultExpandDepth is 0, the root disclosure button should be collapsed
    // We should see the text indicating how many keys, but not the keys themselves
    expect(screen.getByText(/keys/i)).toBeInTheDocument();

    // Keys of children within the collapsed root should not be visible
    expect(screen.queryByText(/person/i)).toBeNull();
    expect(screen.queryByText(/items/i)).toBeNull();
  });

  it("expands and collapses nodes when clicked (starting with defaultExpandDepth 0)", async () => {
    render(<JSONView data={nestedData} defaultExpandDepth={0} />);

    // Initial state: root is collapsed
    expect(screen.queryByText(/person/i)).toBeNull();
    expect(screen.queryByText(/items/i)).toBeNull();

    // Find disclosure button for the root
    const rootButton = screen
      .getAllByRole("button")
      .find((el) => el.textContent?.includes("{"));

    expect(rootButton).toBeDefined();
    if (rootButton) {
      fireEvent.click(rootButton);

      // Now the first level keys should be visible
      await waitFor(() => {
        expect(
          screen.getByText(/person/i, { exact: false }),
        ).toBeInTheDocument();

        // Check for "items" key with a more specific approach - find elements with "items"
        // and filter to find the one that has ":" as a sibling
        const itemsElements = screen.getAllByText(/items/i);
        const itemsKeyElement = itemsElements.find((el) =>
          el.nextSibling?.textContent?.includes(":"),
        );
        expect(itemsKeyElement).toBeDefined();
      });

      // But second level should still be collapsed
      expect(screen.queryByText(/Jane Smith/i)).toBeNull();

      // Get the disclosure button for the person object
      const personButton = screen
        .getAllByRole("button")
        .find((button) => button.textContent?.includes("person"));

      expect(personButton).toBeDefined();
      if (personButton) {
        fireEvent.click(personButton);

        // Now the person details should be visible
        await waitFor(() => {
          expect(screen.getByText(/name/i)).toBeInTheDocument();
          expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
        });
      }

      // Click to collapse the root node
      fireEvent.click(rootButton);

      // First level keys should now be hidden
      await waitFor(() => {
        expect(screen.queryByText(/person/i)).toBeNull();
        expect(screen.queryByText(/items/i)).toBeNull();
      });
    }
  });

  it("copies JSON to clipboard when the copy button is clicked", async () => {
    render(<JSONView copyTitle="Test Data" data={simpleData} />);

    // Find and click the copy button
    const copyButton = screen.getByTestId("text-copy-button");

    // Wrap in act because it causes state updates
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // Verify clipboard API was called with the correct data
    // The content might be formatted differently, so we'll check if it contains the data
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const clipboardCall = (
      navigator.clipboard.writeText as unknown as {
        mock: { calls: string[][] };
      }
    ).mock.calls[0][0];
    expect(clipboardCall).toContain('"age": 30');
    expect(clipboardCall).toContain('"isActive": true');
    expect(clipboardCall).toContain('"name": "John Doe"');

    // We need to wait for the state update and toast call
    await waitFor(() => {
      expect(toast.custom).toHaveBeenCalled();
    });
  });

  it("renders null and undefined values", () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
    };

    render(<JSONView data={data} />);

    expect(screen.getByText(/nullValue/i)).toBeInTheDocument();
    expect(screen.getByTestId("json-null")).toBeInTheDocument();
    expect(screen.getByText(/undefinedValue/i)).toBeInTheDocument();
    expect(screen.getByTestId("json-undefined")).toBeInTheDocument();
  });

  it("expands nested objects in default mode when clicking value toggles", async () => {
    render(<JSONView data={nestedData} defaultExpandDepth={1} />);

    // Expand the "person" object
    const personButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("person"));

    expect(personButton).toBeDefined();
    if (personButton) {
      fireEvent.click(personButton);

      // Now find and click the contact toggle to expand it
      await waitFor(() => {
        const contactButton = screen
          .getAllByRole("button")
          .find((button) => button.textContent?.includes("contact"));
        expect(contactButton).toBeDefined();
        if (contactButton) {
          fireEvent.click(contactButton);
        }
      });

      // Now the content inside the contact object should be visible
      await waitFor(() => {
        expect(screen.getByText(/email/i)).toBeInTheDocument();
        expect(screen.getByText(/jane@example.com/i)).toBeInTheDocument();
        expect(screen.getByText(/phone/i)).toBeInTheDocument();
      });
    }
  });

  it("expands objects within an array to their first level when the array is expanded", async () => {
    const arrayWithNestedObjects = {
      list: [
        {
          details: {
            type: "A",
            value: 100,
          },
          id: 1,
          name: "Item One",
        },
        {
          details: {
            type: "B",
            value: 200,
          },
          id: 2,
          name: "Item Two",
        },
      ],
    };

    render(<JSONView data={arrayWithNestedObjects} defaultExpandDepth={0} />);

    // Initially, everything is collapsed with defaultExpandDepth=0
    expect(screen.getByText(/key/i)).toBeInTheDocument();

    // Expand the root first
    const rootButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("{"));

    expect(rootButton).toBeDefined();
    if (rootButton) {
      fireEvent.click(rootButton);

      // Now we should see the "list" key
      await waitFor(() => {
        expect(screen.getByText(/list/i)).toBeInTheDocument();
      });

      // Expand the list array
      const listButton = screen
        .getAllByRole("button")
        .find((button) => button.textContent?.includes("list"));

      expect(listButton).toBeDefined();
      if (listButton) {
        fireEvent.click(listButton);

        // After expanding "list", all objects within the array should be expanded to first level
        await waitFor(() => {
          // Check for properties in the array items
          expect(screen.getAllByText(/id/i).length).toBeGreaterThan(0);
          expect(screen.getAllByText(/name/i).length).toBeGreaterThan(0);
          expect(screen.getAllByText(/details/i).length).toBeGreaterThan(0);

          // Check for specific values
          expect(screen.getByText(/Item One/i)).toBeInTheDocument();
          expect(screen.getByText(/Item Two/i)).toBeInTheDocument();
        });

        // Now, let's test collapsing the array again
        fireEvent.click(listButton);
        await waitFor(() => {
          expect(screen.queryByText(/Item One/i)).toBeNull();
        });
      }
    }
  });
});

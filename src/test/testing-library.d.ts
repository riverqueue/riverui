import "@testing-library/jest-dom";

declare global {
  namespace Vi {
    interface Assertion {
      toBeDisabled(): void;
      toBeInTheDocument(): void;
      // Add other custom matchers as needed
    }
  }
}

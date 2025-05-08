import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

// Extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Mock ResizeObserver which is not available in the test environment
class ResizeObserverMock {
  disconnect() {}
  observe() {}
  unobserve() {}
}

global.ResizeObserver = ResizeObserverMock;

// Configure React testing environment to support act() with Vitest
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

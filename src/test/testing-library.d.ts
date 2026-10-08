import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

import "vitest";

// jest-dom's Vitest entry still augments the pre-Vitest 5 Assertion signature.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Module augmentation requires an interface to merge the matcher types.
  interface Matchers<
    R extends Promise<void> | void = Promise<void> | void,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Module augmentation must match Vitest's generic parameters.
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}

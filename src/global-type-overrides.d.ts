export {};

// Workaround for lack of BigInt support in storybook:
// https://github.com/storybookjs/storybook/issues/22452
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

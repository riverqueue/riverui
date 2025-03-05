export {};

// Workaround for lack of BigInt support in storybook:
// https://github.com/storybookjs/storybook/issues/22452
declare global {
  interface BigInt {
    toJSON(): string;
  }

  interface Window {
    __riverUiAssetUrl: ((string) => string) | undefined;
    __riverUiBasePath: (() => string) | undefined;
  }
}

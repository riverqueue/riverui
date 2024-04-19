// Workaround for lack of BigInt support in storybook:
// https://github.com/storybookjs/storybook/issues/22452
BigInt.prototype.toJSON = function () {
  return this.toString();
};

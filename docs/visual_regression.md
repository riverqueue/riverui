# Storybook Visual Regression

River UI uses a self-hosted visual regression workflow based on Storybook and
Playwright.

## What runs in CI

- `npm run test-storybook` runs Storybook stories with the Vitest addon so
  rendering and interaction failures are caught.
- `npm run test-visual` runs Playwright screenshot assertions against a built
  static Storybook.
- Visual baseline rendering is standardized on Linux Chromium.

## Marking stories for visual snapshots

Only stories tagged with `visual` are screenshot-tested.

```ts
export const Example: Story = {
  tags: ["visual"],
};
```

Stories without this tag still run in `test-storybook`, but they are skipped by
`test-visual`.

## Optional visual parameters

Stories can define an optional `parameters.visual` contract:

```ts
parameters: {
  visual: {
    viewport: "mobile",
    waitFor: "[data-testid='ready']",
  },
}
```

- `viewport`: `desktop` (default) or `mobile`.
- `waitFor`: CSS selector to wait for before screenshotting.

## Writing screenshot-safe stories

To keep baselines stable:

- Avoid `Date.now()`, `new Date()`, random values, and faker defaults unless
  you pass fixed values.
- Avoid async timing behavior unless there is a deterministic `waitFor`
  selector.
- Prefer static fixtures with explicit timestamps and IDs.

## Local workflow

- Run story execution tests: `npm run test-storybook`
- Run visual tests: `npm run test-visual`
- Update visual baselines intentionally: `npm run test-visual:update`

Updated snapshots are written next to the visual test spec under Playwright's
snapshot directory.

## Debugging CI failures

When visual regression fails, CI uploads Playwright artifacts:

- `playwright-report/` (HTML report)
- `test-results/` (diff images and failure diagnostics)

Use those artifacts to inspect unexpected changes, then either fix regressions
or intentionally update snapshots.

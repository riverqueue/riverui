import { defineConfig } from "@playwright/test";

const isCI = process.env.CI === "true";
const storybookPort = Number(process.env.STORYBOOK_PORT ?? "6006");

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
    },
  },
  outputDir: "test-results",
  reporter: isCI
    ? [
        ["line"],
        [
          "html",
          {
            open: "never",
            outputFolder: "playwright-report",
          },
        ],
      ]
    : [["line"]],
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  testDir: ".",
  testMatch: ["tests/visual/**/*.spec.ts"],
  timeout: 60_000,
  use: {
    browserName: "chromium",
    headless: true,
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    command: `npm run build-storybook && npx http-server storybook-static --port ${storybookPort} --silent`,
    port: storybookPort,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});

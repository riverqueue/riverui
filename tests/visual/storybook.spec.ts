import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type StoryIndex = {
  entries?: Record<string, StoryIndexEntry>;
  stories?: Record<string, StoryIndexEntry>;
};

type StoryIndexEntry = {
  id: string;
  name: string;
  parameters?: {
    visual?: VisualParameters;
  };
  tags?: string[];
  type?: string;
};

type VisualParameters = {
  viewport?: "desktop" | "mobile";
  waitFor?: string;
};

const desktopViewport = { height: 900, width: 1280 };
const mobileViewport = { height: 844, width: 390 };
const storybookPort = process.env.STORYBOOK_PORT ?? "6006";
const storybookBaseURL = `http://127.0.0.1:${storybookPort}`;
const storybookIndexPath = path.resolve("storybook-static/index.json");

const readVisualStories = (): StoryIndexEntry[] => {
  const fileContents = fs.readFileSync(storybookIndexPath, "utf-8");
  const index = JSON.parse(fileContents) as StoryIndex;

  const entries = Object.values(index.entries ?? index.stories ?? {});

  return entries
    .filter((entry) => entry.type === "story" && entry.tags?.includes("visual"))
    .sort((a, b) => a.id.localeCompare(b.id));
};

const visualStories = readVisualStories();

test.describe("storybook visual snapshots", () => {
  test("has at least one visual story", () => {
    expect(visualStories.length).toBeGreaterThan(0);
  });

  for (const story of visualStories) {
    test(`captures ${story.id}`, async ({ page }) => {
      const viewport =
        story.parameters?.visual?.viewport === "mobile"
          ? mobileViewport
          : desktopViewport;

      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });

      const storyURL = new URL("/iframe.html", storybookBaseURL);
      storyURL.searchParams.set("id", story.id);
      storyURL.searchParams.set("viewMode", "story");
      storyURL.searchParams.set("visual-test", "true");

      await page.goto(storyURL.toString(), { waitUntil: "networkidle" });
      await page.locator("#storybook-root").waitFor();

      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const waitForSelector = story.parameters?.visual?.waitFor;
      if (waitForSelector) {
        await page.locator(waitForSelector).first().waitFor();
      }

      await expect(page).toHaveScreenshot(`${story.id}.png`);
    });
  }
});

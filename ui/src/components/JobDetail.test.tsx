import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import JobDetail from "./JobDetail";
import { jobFactory } from "@test/factories/job";

test("adds 1 + 2 to equal 3", () => {
  const job = jobFactory.build();
  const { getByTestId } = render(<JobDetail job={job} />);
  expect(getByTestId("movies-list").children.length).toBe(items.length);
  expect(sum(1, 2)).toBe(3);
});

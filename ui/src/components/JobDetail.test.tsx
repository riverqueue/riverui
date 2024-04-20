import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import JobDetail from "./JobDetail";
import { jobFactory } from "@test/factories/job";

test("adds 1 + 2 to equal 3", () => {
  const job = jobFactory.build();
  const cancel = () => {};
  const retry = () => {};
  const { getByTestId: _getTestById } = render(
    <JobDetail cancel={cancel} job={job} retry={retry} />
  );
  expect(3).toBe(3);
});

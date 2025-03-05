import { jobFactory } from "@test/factories/job";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import JobDetail from "./JobDetail";

test("adds 1 + 2 to equal 3", () => {
  const job = jobFactory.build();
  const cancel = () => {};
  const deleteFn = () => {};
  const retry = () => {};
  const { getByTestId: _getTestById } = render(
    <JobDetail cancel={cancel} deleteFn={deleteFn} job={job} retry={retry} />,
  );
  expect(3).toBe(3);
});

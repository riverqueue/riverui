import { StatesAndCounts } from "@services/states";
import { JobState } from "@services/types";

export type JobStateFilterItem = {
  count: bigint;
  name: string;
  state: JobState;
};

export const jobStateFilterItems: (
  statesAndCounts: StatesAndCounts | undefined,
) => JobStateFilterItem[] = (statesAndCounts) => {
  const getCount = (state: JobState): bigint => {
    if (statesAndCounts) {
      return BigInt(statesAndCounts[state]);
    }
    return BigInt(0);
  };

  return [
    {
      count: getCount(JobState.Pending),
      name: "Pending",
      state: JobState.Pending,
    },
    {
      count: getCount(JobState.Scheduled),
      name: "Scheduled",
      state: JobState.Scheduled,
    },
    {
      count: getCount(JobState.Available),
      name: "Available",
      state: JobState.Available,
    },
    {
      count: getCount(JobState.Running),
      name: "Running",
      state: JobState.Running,
    },
    {
      count: getCount(JobState.Retryable),
      name: "Retryable",
      state: JobState.Retryable,
    },
    {
      count: getCount(JobState.Cancelled),
      name: "Cancelled",
      state: JobState.Cancelled,
    },
    {
      count: getCount(JobState.Discarded),
      name: "Discarded",
      state: JobState.Discarded,
    },
    {
      count: getCount(JobState.Completed),
      name: "Completed",
      state: JobState.Completed,
    },
  ];
};

import { StatesAndCounts } from "@services/states";
import { JobState } from "@services/types";

export type JobStateFilterItem = {
  name: string;
  count: bigint;
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
      name: "Pending",
      state: JobState.Pending,
      count: getCount(JobState.Pending),
    },
    {
      name: "Scheduled",
      state: JobState.Scheduled,
      count: getCount(JobState.Scheduled),
    },
    {
      name: "Available",
      state: JobState.Available,
      count: getCount(JobState.Available),
    },
    {
      name: "Running",
      state: JobState.Running,
      count: getCount(JobState.Running),
    },
    {
      name: "Retryable",
      state: JobState.Retryable,
      count: getCount(JobState.Retryable),
    },
    {
      name: "Cancelled",
      state: JobState.Cancelled,
      count: getCount(JobState.Cancelled),
    },
    {
      name: "Discarded",
      state: JobState.Discarded,
      count: getCount(JobState.Discarded),
    },
    {
      name: "Completed",
      state: JobState.Completed,
      count: getCount(JobState.Completed),
    },
  ];
};

import { StateCountAccuracy, StatesAndCounts } from "@services/states";
import { JobState } from "@services/types";

export type JobStateFilterItem = {
  accuracy: StateCountAccuracy;
  count: bigint;
  name: string;
  observedAt?: Date;
  state: JobState;
};

export const jobStateFilterItems: (
  statesAndCounts: StatesAndCounts | undefined,
) => JobStateFilterItem[] = (statesAndCounts) => {
  const getStateCount = (state: JobState) => {
    return (
      statesAndCounts?.[state] ?? {
        accuracy: "exact" as const,
        count: BigInt(0),
      }
    );
  };

  return [
    {
      ...getStateCount(JobState.Pending),
      name: "Pending",
      state: JobState.Pending,
    },
    {
      ...getStateCount(JobState.Scheduled),
      name: "Scheduled",
      state: JobState.Scheduled,
    },
    {
      ...getStateCount(JobState.Available),
      name: "Available",
      state: JobState.Available,
    },
    {
      ...getStateCount(JobState.Running),
      name: "Running",
      state: JobState.Running,
    },
    {
      ...getStateCount(JobState.Retryable),
      name: "Retryable",
      state: JobState.Retryable,
    },
    {
      ...getStateCount(JobState.Cancelled),
      name: "Cancelled",
      state: JobState.Cancelled,
    },
    {
      ...getStateCount(JobState.Discarded),
      name: "Discarded",
      state: JobState.Discarded,
    },
    {
      ...getStateCount(JobState.Completed),
      name: "Completed",
      state: JobState.Completed,
    },
  ];
};

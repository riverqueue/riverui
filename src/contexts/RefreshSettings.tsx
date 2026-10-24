import { createContext } from "react";

export interface UseRefreshSettingProps {
  /** Refresh interval in milliseconds; 0 disables refresh. */
  intervalMs: number;
  /** Update the interval setting. Set to 0 to disable refresh. */
  setIntervalMs: React.Dispatch<React.SetStateAction<number>>;
}

export const RefreshSettingContext = createContext<
  undefined | UseRefreshSettingProps
>(undefined);

// Temporary: restore to 2000 once dead letter indexes and query performance
// are verified. Users can still enable live updates with the selector.
export const defaultDeadLetterJobsRefreshIntervalMs = 0;

export const DeadLetterJobsRefreshSettingContext =
  createContext<UseRefreshSettingProps>({
    intervalMs: defaultDeadLetterJobsRefreshIntervalMs,
    setIntervalMs: () => {},
  });

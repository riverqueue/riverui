import { createContext } from "react";

export interface UseRefreshSettingProps {
  /** List of all available theme names */
  intervalMs: number;
  /** Update the interval setting. Set to 0 to disable refresh. */
  setIntervalMs: React.Dispatch<React.SetStateAction<number>>;
}

export const RefreshSettingContext = createContext<
  undefined | UseRefreshSettingProps
>(undefined);

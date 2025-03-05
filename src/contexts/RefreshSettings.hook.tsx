import { useContext } from "react";

import {
  RefreshSettingContext,
  UseRefreshSettingProps,
} from "./RefreshSettings";

const defaultContext: UseRefreshSettingProps = {
  intervalMs: 2000,
  setIntervalMs: () => {},
};

export const useRefreshSetting = () =>
  useContext(RefreshSettingContext) ?? defaultContext;

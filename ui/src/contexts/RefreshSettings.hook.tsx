import { useContext } from "react";
import {
  RefreshSettingContext,
  UseRefreshSettingProps,
} from "./RefreshSettings";

const defaultContext: UseRefreshSettingProps = {
  disabled: false,
  intervalMs: 2000,
  setDisabled: () => {},
  setIntervalMs: () => {},
};

export const useRefreshSetting = () =>
  useContext(RefreshSettingContext) ?? defaultContext;

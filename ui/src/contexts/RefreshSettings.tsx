import { Fragment, createContext, useContext, useMemo, useState } from "react";

export interface UseRefreshSettingProps {
  /** List of all available theme names */
  intervalMs: number;
  /** Update the interval setting. Set to 0 to disable refresh. */
  setIntervalMs: React.Dispatch<React.SetStateAction<number>>;
}

export const RefreshSettingContext = createContext<
  UseRefreshSettingProps | undefined
>(undefined);

export interface RefreshSettingProviderProps {
  children?: React.ReactNode;
}

export const RefreshSettingProvider: React.FC<RefreshSettingProviderProps> = (
  props
) => {
  const context = useContext(RefreshSettingContext);

  // Ignore nested context providers, just passthrough children
  if (context) return <Fragment>{props.children}</Fragment>;
  return <RefreshSetting {...props} />;
};

const RefreshSetting: React.FC<RefreshSettingProviderProps> = ({
  children,
}) => {
  const [intervalMs, setIntervalMs] = useState(2000);

  const providerValue = useMemo(
    () => ({
      intervalMs,
      setIntervalMs,
    }),
    [intervalMs, setIntervalMs]
  );

  return (
    <RefreshSettingContext.Provider value={providerValue}>
      {children}
    </RefreshSettingContext.Provider>
  );
};

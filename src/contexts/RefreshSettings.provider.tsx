import { Fragment, useContext, useState, useMemo } from "react";
import { RefreshSettingContext } from "./RefreshSettings";

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

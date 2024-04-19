import { Fragment, createContext, useContext, useMemo, useState } from "react";

export interface UseRefreshSettingProps {
  disabled: boolean;
  /** List of all available theme names */
  intervalMs: number;
  /** Update the disabled setting */
  setDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  /** Update the interval setting */
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
  const [disabled, setDisabled] = useState(false);
  const [intervalMs, setIntervalMs] = useState(2000);

  const providerValue = useMemo(
    () => ({
      disabled,
      intervalMs,
      setDisabled,
      setIntervalMs,
    }),
    [disabled, intervalMs, setDisabled, setIntervalMs]
  );

  return (
    <RefreshSettingContext.Provider value={providerValue}>
      {children}
    </RefreshSettingContext.Provider>
  );
};

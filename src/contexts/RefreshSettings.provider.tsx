import { Fragment, useContext, useMemo, useState } from "react";

import {
  DeadLetterJobsRefreshSettingContext,
  defaultDeadLetterJobsRefreshIntervalMs,
  RefreshSettingContext,
} from "./RefreshSettings";

export interface RefreshSettingProviderProps {
  children?: React.ReactNode;
}

export const RefreshSettingProvider: React.FC<RefreshSettingProviderProps> = (
  props,
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
  // Keep the dead letter choice independent and retain it across navigation.
  const [deadLetterJobsIntervalMs, setDeadLetterJobsIntervalMs] = useState(
    defaultDeadLetterJobsRefreshIntervalMs,
  );

  const providerValue = useMemo(
    () => ({
      intervalMs,
      setIntervalMs,
    }),
    [intervalMs, setIntervalMs],
  );

  const deadLetterJobsProviderValue = useMemo(
    () => ({
      intervalMs: deadLetterJobsIntervalMs,
      setIntervalMs: setDeadLetterJobsIntervalMs,
    }),
    [deadLetterJobsIntervalMs, setDeadLetterJobsIntervalMs],
  );

  return (
    <RefreshSettingContext.Provider value={providerValue}>
      <DeadLetterJobsRefreshSettingContext.Provider
        value={deadLetterJobsProviderValue}
      >
        {children}
      </DeadLetterJobsRefreshSettingContext.Provider>
    </RefreshSettingContext.Provider>
  );
};

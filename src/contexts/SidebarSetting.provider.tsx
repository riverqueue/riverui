import { Fragment, useContext, useMemo, useState } from "react";

import { SidebarSettingContext } from "./SidebarSetting";

export interface SidebarSettingProviderProps {
  children?: React.ReactNode;
}

export interface UseSidebarSettingProps {
  open: boolean;
  /** Update the open setting */
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SidebarSettingProvider: React.FC<SidebarSettingProviderProps> = (
  props,
) => {
  const context = useContext(SidebarSettingContext);

  // Ignore nested context providers, just passthrough children
  if (context) return <Fragment>{props.children}</Fragment>;
  return <SidebarSetting {...props} />;
};

const SidebarSetting: React.FC<SidebarSettingProviderProps> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);

  const providerValue = useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <SidebarSettingContext.Provider value={providerValue}>
      {children}
    </SidebarSettingContext.Provider>
  );
};

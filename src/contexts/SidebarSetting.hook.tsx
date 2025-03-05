import { useContext } from "react";

import { SidebarSettingContext } from "./SidebarSetting";
import { UseSidebarSettingProps } from "./SidebarSetting.provider";

const defaultContext: UseSidebarSettingProps = {
  open: false,
  setOpen: () => {},
};

export const useSidebarSetting = () =>
  useContext(SidebarSettingContext) ?? defaultContext;

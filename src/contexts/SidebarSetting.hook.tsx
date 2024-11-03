import { useContext } from "react";
import { UseSidebarSettingProps } from "./SidebarSetting.provider";
import { SidebarSettingContext } from "./SidebarSetting";

const defaultContext: UseSidebarSettingProps = {
  open: false,
  setOpen: () => {},
};

export const useSidebarSetting = () =>
  useContext(SidebarSettingContext) ?? defaultContext;

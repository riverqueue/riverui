import { useContext } from "react";
import {
  SidebarSettingContext,
  UseSidebarSettingProps,
} from "./SidebarSetting";

const defaultContext: UseSidebarSettingProps = {
  open: false,
  setOpen: () => {},
};

export const useSidebarSetting = () =>
  useContext(SidebarSettingContext) ?? defaultContext;

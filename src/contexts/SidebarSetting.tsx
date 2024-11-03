import { createContext } from "react";
import { UseSidebarSettingProps } from "./SidebarSetting.provider";

export const SidebarSettingContext = createContext<
  UseSidebarSettingProps | undefined
>(undefined);

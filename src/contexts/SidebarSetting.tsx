import { createContext } from "react";

import { UseSidebarSettingProps } from "./SidebarSetting.provider";

export const SidebarSettingContext = createContext<
  undefined | UseSidebarSettingProps
>(undefined);

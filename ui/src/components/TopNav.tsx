import { PropsWithChildren } from "react";

import { Bars3Icon } from "@heroicons/react/24/outline";
import { RefreshPauser } from "@components/RefreshPauser";
import { ThemeSelector } from "@components/ThemeSelector";
import { useSidebarSetting } from "@contexts/SidebarSetting.hook";

type TopNavProps = PropsWithChildren<object>;

const TopNav = ({ children }: TopNavProps) => {
  const { setOpen: setSidebarOpen } = useSidebarSetting();

  return (
    <div className="sticky top-0 z-40 bg-white dark:border-slate-700 dark:bg-slate-900 lg:mx-auto">
      <div className="flex h-16 items-center gap-x-4 border-b  px-4 shadow-sm dark:border-slate-800 sm:gap-x-6 sm:px-6 lg:px-8 lg:shadow-none">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="size-6" aria-hidden="true" />
        </button>

        {/* Separator */}
        <div
          className="h-6 w-px bg-slate-200 dark:bg-slate-700 lg:hidden"
          aria-hidden="true"
        />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="flex flex-1">{children}</div>

          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* Separator */}
            <div
              className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200 dark:lg:bg-slate-700"
              aria-hidden="true"
            />
            <RefreshPauser />
            <ThemeSelector className="relative z-10" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNav;

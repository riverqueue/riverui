import { RefreshPauser } from "@components/RefreshPauser";
import { ThemeSelector } from "@components/ThemeSelector";
import { useSidebarSetting } from "@contexts/SidebarSetting.hook";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { HTMLAttributes, PropsWithChildren } from "react";

type TopNavProps = PropsWithChildren<HTMLAttributes<HTMLElement>>;

const TopNav = ({ children }: TopNavProps) => {
  const { setOpen: setSidebarOpen } = useSidebarSetting();

  return (
    <div className="sticky top-0 z-10 bg-white lg:mx-auto dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-x-4 border-b px-4 shadow-xs sm:gap-x-6 sm:px-6 lg:px-8 lg:shadow-none dark:border-slate-800">
        <button
          className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
          onClick={() => setSidebarOpen(true)}
          type="button"
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon aria-hidden="true" className="size-6" />
        </button>

        {/* Separator */}
        <div
          aria-hidden="true"
          className="h-6 w-px bg-slate-200 lg:hidden dark:bg-slate-700"
        />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="flex flex-1">{children}</div>

          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* Separator */}
            <div
              aria-hidden="true"
              className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200 dark:lg:bg-slate-700"
            />
            <RefreshPauser className="relative z-10" />
            <ThemeSelector className="relative z-10" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNav;

/*
  This example requires some changes to your config:
  
  ```
  // tailwind.config.js
  module.exports = {
    // ...
    plugins: [
      // ...
      require('@tailwindcss/forms'),
    ],
  }
  ```
*/
import { Fragment, PropsWithChildren } from "react";

import { Dialog, Transition } from "@headlessui/react";
import {
  Cog6ToothIcon,
  InboxStackIcon,
  QueueListIcon,
  RectangleGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { classNames } from "@utils/style";
import { Link } from "@tanstack/react-router";
import { JobState } from "@services/types";
import { useSidebarSetting } from "@contexts/SidebarSetting.hook";

type LayoutProps = PropsWithChildren<object>;

const navigation = [
  {
    name: "Jobs",
    href: "/jobs",
    icon: QueueListIcon,
    search: { state: JobState.Running },
  },
  { name: "Queues", href: "queues", icon: InboxStackIcon },
  { name: "Workflows", href: "#", icon: RectangleGroupIcon },
];

const Layout = ({ children }: LayoutProps) => {
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebarSetting();

  return (
    <>
      {/*
        This example requires updating your template:

        ```
        <html class="h-full bg-white">
        <body class="h-full">
        ```
      */}
      <div className="h-full">
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50 lg:hidden"
            onClose={setSidebarOpen}
          >
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-slate-100/80 dark:bg-slate-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button
                        type="button"
                        className="-m-2.5 p-2.5"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon
                          className="size-6 text-slate-900 dark:text-slate-100"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </Transition.Child>

                  <div className="flex grow flex-col bg-gray-100 ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10">
                    {/* Componentize this, I only removed the w-40 class: */}
                    <div className="flex grow flex-col">
                      <nav className="flex flex-1 flex-col">
                        <ul role="list" className="flex   flex-1 flex-col">
                          <>
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <Link
                                  to={item.href}
                                  search={item.search}
                                  className="group flex gap-x-5 border-l-4 p-5 pl-4 text-sm font-semibold leading-6 transition-colors"
                                  activeProps={{
                                    className:
                                      "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 dark:hover:text-white border-brand-primary",
                                  }}
                                  inactiveProps={{
                                    className:
                                      "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                                  }}
                                >
                                  <item.icon
                                    className="size-6 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </>
                          <li className="mt-auto">
                            <a
                              href="#"
                              className={classNames(
                                "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                                "group flex gap-x-5 p-5 text-sm leading-6 font-semibold border-l-4 transition-colors"
                              )}
                            >
                              <Cog6ToothIcon
                                className="size-6 shrink-0"
                                aria-hidden="true"
                              />
                              Settings
                            </a>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </div>
                  {/* <JobFilters statesAndCounts={statesAndCounts} /> */}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden overflow-x-hidden bg-slate-100 shadow shadow-slate-400 transition-all hover:w-40 dark:bg-slate-800 dark:shadow-slate-600 lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-16 lg:overflow-y-auto lg:pb-4">
          <div className="flex w-40 grow flex-col">
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex   flex-1 flex-col">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      search={item.search}
                      className="group flex gap-x-5 border-l-4 p-5 pl-4 text-sm font-semibold leading-6 transition-colors"
                      activeProps={{
                        className:
                          "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 dark:hover:text-white border-brand-primary",
                      }}
                      inactiveProps={{
                        className:
                          "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                      }}
                    >
                      <item.icon
                        className="size-6 shrink-0"
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                ))}
                <li className="mt-auto">
                  <a
                    href="#"
                    className={classNames(
                      "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                      "group flex gap-x-5 p-5 text-sm leading-6 font-semibold border-l-4 transition-colors"
                    )}
                  >
                    <Cog6ToothIcon
                      className="size-6 shrink-0"
                      aria-hidden="true"
                    />
                    Settings
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="h-full lg:pl-16">
          <main className="h-full">{children}</main>
        </div>
      </div>
    </>
  );
};

export default Layout;

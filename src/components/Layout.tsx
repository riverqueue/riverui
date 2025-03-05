import Toast from "@components/Toast";
import { useSidebarSetting } from "@contexts/SidebarSetting.hook";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  InboxStackIcon,
  QueueListIcon,
  RectangleGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import useFeature from "@hooks/use-feature";
import { Link } from "@tanstack/react-router";
import { Fragment, PropsWithChildren, useMemo } from "react";

type LayoutProps = PropsWithChildren<object>;

const Layout = ({ children }: LayoutProps) => {
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebarSetting();

  const featureEnabledWorkflows = useFeature("ENABLE_WORKFLOWS", true);

  const navigation = useMemo(
    () =>
      [
        {
          href: "/jobs",
          icon: QueueListIcon,
          name: "Jobs",
          search: {},
        },
        { href: "/queues", icon: InboxStackIcon, name: "Queues" },
        {
          hidden: !featureEnabledWorkflows,
          href: "/workflows",
          icon: RectangleGroupIcon,
          name: "Workflows",
        },
      ].filter((item) => item.hidden === undefined || item.hidden === false),
    [featureEnabledWorkflows],
  );

  return (
    <>
      <div className="h-full">
        <Transition as={Fragment} show={sidebarOpen}>
          <Dialog
            as="div"
            className="relative z-50 lg:hidden"
            onClose={setSidebarOpen}
          >
            <TransitionChild
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-slate-100/80 dark:bg-slate-900/80" />
            </TransitionChild>

            <div className="fixed inset-0 flex">
              <TransitionChild
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <TransitionChild
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute top-0 left-full flex w-16 justify-center pt-5">
                      <button
                        className="-m-2.5 p-2.5"
                        onClick={() => setSidebarOpen(false)}
                        type="button"
                      >
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon
                          aria-hidden="true"
                          className="size-6 text-slate-900 dark:text-slate-100"
                        />
                      </button>
                    </div>
                  </TransitionChild>

                  <div className="flex grow flex-col bg-gray-100 ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10">
                    {/* Componentize this, I only removed the w-40 class: */}
                    <div className="flex grow flex-col">
                      <nav className="flex flex-1 flex-col">
                        <ul className="flex flex-1 flex-col" role="list">
                          <>
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <Link
                                  activeProps={{
                                    className:
                                      "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 dark:hover:text-white border-brand-primary",
                                  }}
                                  className="group flex gap-x-5 border-l-4 p-5 pl-4 text-sm leading-6 font-semibold transition-colors"
                                  inactiveProps={{
                                    className:
                                      "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                                  }}
                                  onClick={() => setSidebarOpen(false)}
                                  search={item.search}
                                  to={item.href}
                                >
                                  <item.icon
                                    aria-hidden="true"
                                    className="size-6 shrink-0"
                                  />
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </>
                        </ul>
                      </nav>
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>

        {/* Static sidebar for desktop */}
        <div className="hidden overflow-x-hidden bg-slate-100 shadow-sm shadow-slate-400 transition-all hover:w-40 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-16 lg:overflow-y-auto lg:pb-4 dark:bg-slate-800 dark:shadow-slate-600">
          <div className="flex w-40 grow flex-col">
            <nav className="flex flex-1 flex-col">
              <ul className="flex flex-1 flex-col" role="list">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      activeProps={{
                        className:
                          "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 dark:hover:text-white border-brand-primary",
                      }}
                      className="group flex gap-x-5 border-l-4 p-5 pl-4 text-sm leading-6 font-semibold transition-colors"
                      inactiveProps={{
                        className:
                          "text-slate-600 dark:text-slate-400 dark:hover:text-white hover:text-slate-900 border-transparent dark:hover:bg-slate-800 hover:bg-slate-200",
                      }}
                      search={item.search}
                      to={item.href}
                    >
                      <item.icon
                        aria-hidden="true"
                        className="size-6 shrink-0"
                      />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="h-full lg:pl-16">
          <main className="h-full">{children}</main>
        </div>
      </div>
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-50 flex items-end px-4 py-6 sm:items-start sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <Toast />
        </div>
      </div>
    </>
  );
};

export default Layout;

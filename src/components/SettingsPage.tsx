import { Button } from "@components/Button";
import TopNavTitleOnly from "@components/TopNavTitleOnly";
import { useFeatures } from "@contexts/Features.hook";
import { Switch } from "@headlessui/react";
import { useSettings } from "@hooks/use-settings";
import clsx from "clsx";

export default function SettingsPage() {
  const { features } = useFeatures();
  const { clearShowJobArgs, setShowJobArgs, settings, shouldShowJobArgs } =
    useSettings();

  // Determine if we're using an override or the default value
  const isUsingOverride = settings.showJobArgs !== undefined;

  // Generate unique IDs for accessibility
  const toggleId = "job-args-toggle";
  const descriptionId = "job-args-description";

  return (
    <div className="size-full">
      <TopNavTitleOnly title="Settings" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-10 divide-y divide-slate-900/10 dark:divide-slate-100/10">
          <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
            <div className="px-4 sm:px-0">
              <h2 className="text-base leading-7 font-semibold text-slate-900 dark:text-slate-100">
                Display
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Customize how information is displayed in the UI.
              </p>
            </div>

            <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5 md:col-span-2 dark:bg-slate-800 dark:ring-slate-100/10">
              <div className="px-4 py-6 sm:p-8">
                <div className="max-w-2xl space-y-6">
                  <div>
                    <h3 className="text-base leading-6 font-semibold text-slate-900 dark:text-slate-100">
                      Job arguments
                    </h3>

                    <div className="mt-4">
                      <div className="flex gap-3">
                        <div className="flex h-6 items-center">
                          <Switch
                            checked={shouldShowJobArgs}
                            className={clsx(
                              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:outline-none",
                              shouldShowJobArgs
                                ? "bg-brand-primary"
                                : "bg-gray-200 dark:bg-gray-600",
                            )}
                            data-testid="job-args-toggle"
                            id={toggleId}
                            onChange={(checked) => setShowJobArgs(checked)}
                          >
                            <span className="sr-only">Show job arguments</span>
                            <span
                              aria-hidden="true"
                              className={clsx(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                shouldShowJobArgs
                                  ? "translate-x-5"
                                  : "translate-x-0",
                              )}
                            />
                          </Switch>
                        </div>
                        <div className="text-sm/6">
                          <label
                            className="font-medium text-slate-900 dark:text-slate-100"
                            data-testid="job-args-label"
                            htmlFor={toggleId}
                          >
                            Show job arguments in job list
                          </label>
                          <p
                            className="text-slate-500 dark:text-slate-400"
                            data-testid="job-args-description"
                            id={descriptionId}
                          >
                            When enabled, job arguments will be displayed in the
                            job list view. This can be helpful for debugging and
                            identifying specific job instances.
                          </p>
                        </div>
                      </div>

                      {isUsingOverride && (
                        <div className="mt-4 flex items-center gap-x-4 rounded-md bg-gray-50 p-3 text-sm ring-1 ring-gray-200 dark:bg-slate-700/30 dark:ring-slate-700">
                          <div className="flex-grow">
                            <span
                              className="text-slate-700 dark:text-slate-300"
                              data-testid="job-args-default"
                            >
                              <span
                                className="mt-1 block"
                                data-testid="job-args-override-msg"
                              >
                                You're overriding the system default (args{" "}
                                {features.jobListHideArgsByDefault
                                  ? "hidden"
                                  : "shown"}
                                ).
                              </span>
                            </span>
                          </div>

                          <Button
                            data-testid="job-args-reset-btn"
                            onClick={() => clearShowJobArgs()}
                            outline
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

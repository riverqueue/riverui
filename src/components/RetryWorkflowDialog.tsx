import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { type WorkflowRetryMode } from "@services/workflows";
import { useEffect, useState } from "react";

export type RetryWorkflowDialogProps = {
  defaultMode?: WorkflowRetryMode;
  defaultResetHistory?: boolean;
  onClose: () => void;
  onConfirm: (mode: WorkflowRetryMode, resetHistory: boolean) => void;
  open: boolean;
  pending?: boolean;
};

export default function RetryWorkflowDialog({
  defaultMode,
  defaultResetHistory = false,
  onClose,
  onConfirm,
  open,
  pending,
}: RetryWorkflowDialogProps) {
  const [mode, setMode] = useState<undefined | WorkflowRetryMode>(defaultMode);
  const [resetHistory, setResetHistory] =
    useState<boolean>(defaultResetHistory);

  useEffect(() => {
    if (!open) {
      setMode(defaultMode);
      setResetHistory(defaultResetHistory);
    }
  }, [open, defaultMode, defaultResetHistory]);

  return (
    <Dialog className="relative z-10" onClose={onClose} open={open}>
      <DialogBackdrop
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
        transition
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10"
            transition
          >
            <div className="bg-white dark:bg-gray-800">
              <div className="px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-left sm:mt-0 sm:ml-0 sm:text-left">
                    <DialogTitle
                      as="h3"
                      className="text-base font-semibold text-gray-900 dark:text-white"
                    >
                      Retry workflow
                    </DialogTitle>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Choose how to retry this workflow.
                    </div>

                    <div className="mt-4 space-y-6">
                      <fieldset aria-label="Retry mode">
                        <div className="space-y-6">
                          <label className="flex cursor-pointer items-start gap-x-3">
                            <div className="flex h-6 shrink-0 items-center">
                              <input
                                checked={mode === "all"}
                                className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 dark:border-white/10 dark:bg-white/5 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:focus-visible:outline-blue-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:before:bg-white/20 forced-colors:appearance-auto forced-colors:before:hidden"
                                id="retry-mode-all"
                                name="retry-mode"
                                onChange={() => setMode("all")}
                                type="radio"
                              />
                            </div>
                            <div className="text-sm/6">
                              <span className="font-medium text-gray-900 dark:text-white">
                                All jobs
                              </span>
                              <p className="text-gray-500 dark:text-gray-400">
                                Retry every job in the workflow.
                              </p>
                            </div>
                          </label>

                          <label className="flex cursor-pointer items-start gap-x-3">
                            <div className="flex h-6 shrink-0 items-center">
                              <input
                                checked={mode === "failed_only"}
                                className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 dark:border-white/10 dark:bg-white/5 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:focus-visible:outline-blue-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:before:bg-white/20 forced-colors:appearance-auto forced-colors:before:hidden"
                                id="retry-mode-failed-only"
                                name="retry-mode"
                                onChange={() => setMode("failed_only")}
                                type="radio"
                              />
                            </div>
                            <div className="text-sm/6">
                              <span className="font-medium text-gray-900 dark:text-white">
                                Only failed jobs
                              </span>
                              <p className="text-gray-500 dark:text-gray-400">
                                Only retry jobs that failed (discarded or
                                cancelled).
                              </p>
                            </div>
                          </label>

                          <label className="flex cursor-pointer items-start gap-x-3">
                            <div className="flex h-6 shrink-0 items-center">
                              <input
                                checked={mode === "failed_and_downstream"}
                                className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 dark:border-white/10 dark:bg-white/5 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:focus-visible:outline-blue-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:before:bg-white/20 forced-colors:appearance-auto forced-colors:before:hidden"
                                id="retry-mode-failed-downstream"
                                name="retry-mode"
                                onChange={() =>
                                  setMode("failed_and_downstream")
                                }
                                type="radio"
                              />
                            </div>
                            <div className="text-sm/6">
                              <span className="font-medium text-gray-900 dark:text-white">
                                Failed jobs + dependents
                              </span>
                              <p className="text-gray-500 dark:text-gray-400">
                                Retry failed jobs and any downstream jobs that
                                depend on them, even if they previously
                                succeeded.
                              </p>
                            </div>
                          </label>
                        </div>
                      </fieldset>

                      <div>
                        <h4 className="mb-4 text-sm/6 font-semibold text-gray-900 dark:text-white">
                          Options
                        </h4>
                        <label className="flex cursor-pointer items-start gap-3">
                          <div className="flex h-6 shrink-0 items-center">
                            <div className="group grid size-4 grid-cols-1">
                              <input
                                aria-describedby="retry-reset-history-description"
                                checked={resetHistory}
                                className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-brand-primary checked:bg-brand-primary indeterminate:border-brand-primary indeterminate:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:indeterminate:border-blue-500 dark:indeterminate:bg-blue-500 dark:focus-visible:outline-blue-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:checked:bg-white/10 forced-colors:appearance-auto"
                                id="retry-reset-history"
                                name="retry-reset-history"
                                onChange={(e) =>
                                  setResetHistory(e.target.checked)
                                }
                                type="checkbox"
                              />
                              <svg
                                className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25 dark:group-has-disabled:stroke-white/25"
                                fill="none"
                                viewBox="0 0 14 14"
                              >
                                <path
                                  className="opacity-0 group-has-checked:opacity-100"
                                  d="M3 8L6 11L11 3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                />
                                <path
                                  className="opacity-0 group-has-indeterminate:opacity-100"
                                  d="M3 7H11"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                />
                              </svg>
                            </div>
                          </div>
                          <div className="text-left text-sm/6">
                            <span className="font-medium text-gray-900 dark:text-white">
                              Reset history
                            </span>
                            <p
                              className="text-gray-500 dark:text-gray-400"
                              id="retry-reset-history-description"
                            >
                              Resets attempt counts and error history of all
                              retried jobs. If not checked, each retried job
                              gets one added to its max attempts.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
                <button
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs enabled:hover:bg-blue-500 disabled:opacity-50 sm:ml-3 sm:w-auto dark:bg-blue-500 dark:shadow-none dark:enabled:hover:bg-blue-400"
                  disabled={!mode || pending}
                  onClick={() => {
                    if (mode) onConfirm(mode, resetHistory);
                  }}
                  type="button"
                >
                  Re-run jobs
                </button>
                <button
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
                  data-autofocus
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

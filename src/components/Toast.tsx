import { Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import toast, {
  type Toast as ToastType,
  resolveValue,
  useToaster,
} from "react-hot-toast";

export const ToastContentSuccess = ({
  message,
  subtext,
  t,
}: {
  message: string;
  subtext?: string;
  t: ToastType;
}) => (
  <div className="flex items-start">
    <div className="shrink-0">
      <CheckCircleIcon className="size-6 text-green-400" aria-hidden="true" />
    </div>
    <div className="ml-3 w-0 flex-1 pt-0.5">
      <p className="text-sm font-medium text-slate-900 dark:text-white">
        {message}
      </p>
      {(subtext || "").length > 0 && (
        <p className="mt-1 text-sm text-gray-500">{subtext}</p>
      )}
    </div>
    <div className="ml-4 flex shrink-0">
      <button
        type="button"
        className="inline-flex rounded-md bg-white text-slate-400 hover:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-slate-900 dark:text-slate-500"
        onClick={() => toast.dismiss(t.id)}
      >
        <span className="sr-only">Close</span>
        <XMarkIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  </div>
);

export const ToastContentError = ({
  message,
  subtext,
  t,
}: {
  message: string;
  subtext?: string;
  t: ToastType;
}) => (
  <div className="flex items-start">
    <div className="shrink-0">
      <XCircleIcon
        className="size-6 text-red-200 dark:text-red-700"
        aria-hidden="true"
      />
    </div>
    <div className="ml-3 w-0 flex-1 pt-0.5">
      <p className="text-sm font-medium text-slate-900 dark:text-white">
        {message}
      </p>
      {(subtext || "").length > 0 && (
        <p className="mt-1 text-sm text-gray-500">{subtext}</p>
      )}
    </div>
    <div className="ml-4 flex shrink-0">
      <button
        type="button"
        className="inline-flex rounded-md bg-white text-slate-400 hover:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-slate-900 dark:text-slate-500"
        onClick={() => toast.dismiss(t.id)}
      >
        <span className="sr-only">Close</span>
        <XMarkIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  </div>
);

export default function Toast() {
  const { toasts, handlers } = useToaster();
  const { startPause, endPause } = handlers;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex items-end p-4 sm:items-start sm:p-4"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {toasts.map((t) => (
          <Transition
            appear
            key={t.id}
            show={t.visible}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/5"
              onMouseEnter={startPause}
              onMouseLeave={endPause}
              {...t.ariaProps}
            >
              <div className="p-4">{resolveValue(t.message, t)}</div>
            </div>
          </Transition>
        ))}
      </div>
    </div>
  );
}

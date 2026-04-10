import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { type ReactNode } from "react";

export type ConfirmationDialogProps = {
  cancelText?: string;
  confirmText: string;
  description: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  pending?: boolean;
  title: string;
};

export default function ConfirmationDialog({
  cancelText = "Cancel",
  confirmText,
  description,
  onClose,
  onConfirm,
  open,
  pending = false,
  title,
}: ConfirmationDialogProps) {
  if (!open) return null;

  const handleClose = () => {
    if (!pending) {
      onClose();
    }
  };

  return (
    <Dialog className="relative z-[60]" onClose={handleClose} open>
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
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 dark:bg-gray-800">
              <DialogTitle
                as="h3"
                className="text-base font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </DialogTitle>
              <Description
                as="div"
                className="mt-2 text-sm text-gray-600 dark:text-gray-400"
              >
                {description}
              </Description>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
              <button
                className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs enabled:hover:bg-red-500 disabled:opacity-50 sm:ml-3 sm:w-auto dark:bg-red-500 dark:shadow-none dark:enabled:hover:bg-red-400"
                disabled={pending}
                onClick={onConfirm}
                type="button"
              >
                {confirmText}
              </button>
              <button
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 disabled:opacity-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
                data-autofocus
                disabled={pending}
                onClick={handleClose}
                type="button"
              >
                {cancelText}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

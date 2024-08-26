import { ToastContentError, ToastContentSuccess } from "@components/Toast";
import toast, { Toast, ToastOptions } from "react-hot-toast";

export function toastError({
  message,
  subtext,
  ...options
}: {
  message: string;
  subtext?: string;
} & ToastOptions) {
  toast.custom(
    (t: Toast) => (
      <ToastContentError message={message} subtext={subtext} t={t} />
    ),
    options
  );
}

export function toastSuccess({
  message,
  subtext,
  ...options
}: {
  message: string;
  subtext?: string;
} & ToastOptions) {
  toast.custom(
    (t: Toast) => (
      <ToastContentSuccess message={message} subtext={subtext} t={t} />
    ),
    options
  );
}

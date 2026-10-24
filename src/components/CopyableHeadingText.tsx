import { CheckIcon } from "@heroicons/react/16/solid";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { toastSuccess } from "@services/toast";
import { capitalize } from "@utils/string";
import { useState } from "react";

type CopyableHeadingTextProps = {
  // Names what is copied, in lowercase, such as "job kind".
  label: string;
  text: string;
};

// CopyableHeadingText keeps a heading on one line. Text that doesn't fit
// is cut with an ellipsis, and the copy button and tooltip give the full
// text.
export default function CopyableHeadingText({
  label,
  text,
}: CopyableHeadingTextProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!navigator.clipboard?.writeText) {
      console.error(`Failed to copy ${label}: Clipboard API unavailable`);
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toastSuccess({ message: `${capitalize(label)} copied to clipboard` });
        setTimeout(() => setCopied(false), 2000);
      },
      (error: unknown) => {
        console.error(`Failed to copy ${label} to clipboard:`, error);
      },
    );
  };

  return (
    <span className="inline-flex max-w-full items-center gap-x-2">
      <span
        className="block min-w-0 truncate font-semibold text-slate-900 dark:text-white"
        title={text}
      >
        {text}
      </span>
      <button
        className="inline-flex shrink-0 cursor-pointer items-center rounded p-1 text-slate-500 hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary dark:text-slate-400 dark:hover:text-brand-primary"
        onClick={copyToClipboard}
        title={`Copy ${label}`}
        type="button"
      >
        {copied ? (
          <CheckIcon aria-hidden="true" className="size-4 text-green-500" />
        ) : (
          <ClipboardIcon aria-hidden="true" className="size-4" />
        )}
      </button>
    </span>
  );
}

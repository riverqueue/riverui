import type { ReactNode } from "react";

import { CheckIcon } from "@heroicons/react/16/solid";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";

import { ToastContentSuccess } from "@/components/Toast";

type CopyablePanelProps = {
  children: ReactNode;
  /**
   * Additional class names to apply to the component.
   */
  className?: string;
  /**
   * Raw text to be copied to clipboard.
   */
  copyText: string;
  /**
   * The title to show in the copy confirmation toast.
   * @default "Text"
   */
  copyTitle?: string;
};

const styleConfig = {
  container: {
    base: "relative overflow-auto rounded-md bg-slate-50 dark:bg-slate-800",
    font: { fontFamily: "var(--font-family-monospace, monospace)" },
  },
  content: {
    base: "relative overflow-x-auto overscroll-y-auto p-1 pl-2 text-xs",
  },
  header: {
    base: "flex items-center justify-end bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700",
    textAlign: { textAlign: "right" as const },
  },
  icon: {
    base: "h-3 w-3",
    check: "text-green-500",
    clipboard:
      "text-slate-500 dark:text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary",
  },
};

/**
 * A panel that wraps copyable content with a copy button.
 */
export default function CopyablePanel({
  children,
  className,
  copyText,
  copyTitle = "Text",
}: CopyablePanelProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(copyText).then(
      () => {
        setIsCopied(true);
        toast.custom((t) => (
          <ToastContentSuccess
            message={`${copyTitle} copied to clipboard`}
            t={t}
          />
        ));
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      },
      (err) => {
        console.error("Failed to copy text: ", err);
      },
    );
  };

  return (
    <div
      className={`${styleConfig.container.base} ${className || ""}`}
      style={styleConfig.container.font}
    >
      <div
        className={styleConfig.header.base}
        style={styleConfig.header.textAlign}
      >
        <button
          className="inline-flex cursor-pointer items-center rounded p-1"
          data-testid="text-copy-button"
          onClick={copyToClipboard}
          tabIndex={0}
          title="Copy to clipboard"
          type="button"
        >
          {isCopied ? (
            <CheckIcon
              aria-hidden="true"
              className={`${styleConfig.icon.base} ${styleConfig.icon.check}`}
            />
          ) : (
            <ClipboardIcon
              aria-hidden="true"
              className={`${styleConfig.icon.base} ${styleConfig.icon.clipboard}`}
            />
          )}
        </button>
      </div>
      <div className={styleConfig.content.base}>{children}</div>
    </div>
  );
}

import { CheckIcon } from "@heroicons/react/16/solid";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import React from "react";
import toast from "react-hot-toast";

import { ToastContentSuccess } from "@/components/Toast";

type PlaintextPanelProps = {
  /**
   * Additional class names to apply to the component.
   */
  className?: string;
  /**
   * Additional class names to apply to the code element.
   */
  codeClassName?: string;
  /**
   * The content to be displayed in the panel.
   */
  content: React.ReactNode;
  /**
   * The title to show in the copy confirmation toast.
   * @default "Text"
   */
  copyTitle?: string;
  /**
   * Raw text to be copied to clipboard instead of extracting from content.
   */
  rawText?: string;
};

const styleConfig = {
  container: {
    base: "relative overflow-auto rounded-md bg-slate-50 dark:bg-slate-800",
    font: { fontFamily: "var(--font-family-monospace, monospace)" },
  },
  content: {
    base: "relative text-xs p-1 pl-2",
    code: "block text-slate-800 dark:text-slate-200",
    layout: {
      overflowX: "auto" as const,
      overscrollBehaviorY: "auto" as const,
    },
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
 * A component that renders plaintext content with a copy button.
 */
export default function PlaintextPanel({
  className,
  codeClassName,
  content,
  copyTitle = "Text",
  rawText,
}: PlaintextPanelProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    const textContent = rawText || extractTextFromNode(content);
    navigator.clipboard.writeText(textContent).then(
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
      {/* Header with copy button */}
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
      {/* Content block */}
      <div
        className={styleConfig.content.base}
        style={styleConfig.content.layout}
      >
        <code className={`${styleConfig.content.code} ${codeClassName || ""}`}>
          {content}
        </code>
      </div>
    </div>
  );
}

// Helper function to extract text from React nodes
function extractTextFromNode(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return node.toString();
  if (Array.isArray(node)) return node.map(extractTextFromNode).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    const children = node.props.children;
    if (children) return extractTextFromNode(children);
  }
  return "";
}

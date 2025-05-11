import { ToastContentSuccess } from "@/components/Toast";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import React from "react";
import toast from "react-hot-toast";

interface JSONNodeRendererProps {
  data: unknown;
  defaultExpandDepth: number;
  depth: number;
  isLastItemInParent: boolean;
  isParentArrayItem?: boolean; // True if the direct parent of this node is an array
  propKey: null | string; // Key if this node is a property of an object
}

interface JSONViewProps {
  /**
   * The title to show in the copy confirmation toast.
   * @default "JSON"
   */
  copyTitle?: string;
  data: unknown;
  /**
   * The maximum depth to automatically expand to.
   * @default 1
   */
  defaultExpandDepth?: number;
}

/**
 * A component that renders JSON data with collapsible sections and a copy button.
 */
export default function JSONView({
  copyTitle = "JSON",
  data,
  defaultExpandDepth = 1,
}: JSONViewProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(
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
        console.error("Failed to copy JSON: ", err);
      },
    );
  };

  const styleConfig = {
    container: {
      base: "relative overflow-auto rounded-md bg-slate-50 dark:bg-slate-800",
      font: { fontFamily: "var(--font-family-monospace, monospace)" },
    },
    content: {
      base: "relative text-xs",
      code: "block text-slate-800 dark:text-slate-200",
      layout: {
        overflowX: "auto" as const,
        overscrollBehaviorY: "auto" as const,
        paddingBottom: "4px",
        paddingLeft: "24px",
        paddingTop: "4px",
      },
    },
    header: {
      base: "flex items-center justify-end bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700",
      textAlign: { textAlign: "right" as const },
    },
    icon: {
      base: "h-3 w-3",
      check: "text-green-500",
      chevron: "text-slate-600 dark:text-slate-400",
      clipboard:
        "text-slate-500 dark:text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary",
    },
    json: {
      button: {
        alignItems: "baseline",
        cursor: "pointer",
        display: "flex",
        padding: "2px 0",
        position: "relative",
      },
      chevron: {
        left: "-16px",
        lineHeight: 1,
        position: "absolute",
        top: "0.35em",
      },
      item: {
        paddingBottom: "2px",
        paddingTop: "2px",
        position: "relative",
      },
      key: "text-slate-600 dark:text-slate-400",
      node: {
        alignItems: "flex-start",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      },
      panel: {
        marginLeft: "1.5em",
        paddingTop: "2px",
        width: "100%",
      },
      summary: {
        base: "text-slate-600 dark:text-slate-400",
        style: { fontStyle: "italic", margin: "0 4px" },
      },
      value: {
        boolean: "text-red-600 dark:text-red-400",
        default: "text-slate-800 dark:text-slate-200",
        null: "text-red-600 dark:text-red-400",
        number: "text-amber-600 dark:text-amber-400",
        string: "text-green-600 dark:text-green-400",
      },
    },
  };

  return (
    <div
      className={styleConfig.container.base}
      data-testid="json-view"
      style={styleConfig.container.font}
    >
      {/* Header with copy button */}
      <div
        className={styleConfig.header.base}
        style={styleConfig.header.textAlign}
      >
        <button
          className="inline-flex cursor-pointer items-center rounded p-1"
          data-testid="json-copy-button"
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
      {/* JSON code block */}
      <div
        className={styleConfig.content.base}
        style={styleConfig.content.layout}
      >
        <code className={styleConfig.content.code}>
          <JSONNodeRenderer
            data={data}
            defaultExpandDepth={defaultExpandDepth}
            depth={0}
            isLastItemInParent={true}
            isParentArrayItem={false}
            propKey={null}
          />
        </code>
      </div>
    </div>
  );
}

function JSONNodeRenderer({
  data,
  defaultExpandDepth,
  depth,
  isLastItemInParent,
  isParentArrayItem = false,
  propKey,
}: JSONNodeRendererProps) {
  const styleConfig = {
    container: {
      base: "relative overflow-auto rounded-md bg-slate-50 dark:bg-slate-800",
      font: { fontFamily: "var(--font-family-monospace, monospace)" },
    },
    content: {
      base: "relative text-xs",
      code: "block text-slate-800 dark:text-slate-200",
      layout: {
        overflowX: "auto" as const,
        overscrollBehaviorY: "auto" as const,
        paddingBottom: "4px",
        paddingLeft: "24px",
        paddingTop: "4px",
      },
    },
    header: {
      base: "flex items-center justify-end bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700",
      textAlign: { textAlign: "right" as const },
    },
    icon: {
      base: "h-3 w-3",
      check: "text-green-500",
      chevron: "text-slate-600 dark:text-slate-400",
      clipboard:
        "text-slate-500 dark:text-slate-400 hover:text-brand-primary dark:hover:text-brand-primary",
    },
    json: {
      button: {
        alignItems: "baseline",
        cursor: "pointer",
        display: "flex",
        padding: "2px 0",
        position: "relative",
      },
      chevron: {
        left: "-16px",
        lineHeight: 1,
        position: "absolute",
        top: "0.35em",
      },
      item: {
        paddingBottom: "2px",
        paddingTop: "2px",
        position: "relative",
      },
      key: "text-slate-600 dark:text-slate-400",
      node: {
        alignItems: "flex-start",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      },
      panel: {
        marginLeft: "1.5em",
        paddingTop: "2px",
        width: "100%",
      },
      summary: {
        base: "text-slate-600 dark:text-slate-400",
        style: { fontStyle: "italic", margin: "0 4px" },
      },
      value: {
        boolean: "text-red-600 dark:text-red-400",
        default: "text-slate-800 dark:text-slate-200",
        null: "text-red-600 dark:text-red-400",
        number: "text-amber-600 dark:text-amber-400",
        string: "text-green-600 dark:text-green-400",
      },
    },
  };

  const valueColor = (type: string) => {
    if (type === "string") return styleConfig.json.value.string;
    if (type === "number") return styleConfig.json.value.number;
    if (type === "boolean") return styleConfig.json.value.boolean;
    if (type === "null") return styleConfig.json.value.null;
    return styleConfig.json.value.default;
  };
  const color = styleConfig.json.key;

  // For primitive values, render key and value inline
  if (propKey && (typeof data !== "object" || data === null)) {
    return (
      <span
        style={{
          alignItems: "baseline",
          display: "flex",
          flexDirection: "row",
          whiteSpace: "nowrap",
        }}
      >
        <span className={styleConfig.json.key}>&quot;{propKey}&quot;</span>
        <span className={styleConfig.json.key}>:&nbsp;</span>
        {typeof data === "string" ? (
          <span className={valueColor("string")} style={{ whiteSpace: "pre" }}>
            {JSON.stringify(data)}
            {maybeComma(isLastItemInParent)}
          </span>
        ) : (
          renderValue(
            data,
            valueColor,
            isLastItemInParent,
            depth,
            defaultExpandDepth,
            isParentArrayItem,
          )
        )}
      </span>
    );
  }

  // For non-primitive values (objects/arrays) or non-property values, use the normal rendering
  if (!propKey) {
    return renderValue(
      data,
      valueColor,
      isLastItemInParent,
      depth,
      defaultExpandDepth,
      isParentArrayItem,
    );
  }

  // For objects/arrays that are property values, render the key inline with the value
  const isArray = Array.isArray(data);
  const entries = isArray
    ? data
    : Object.entries(data as Record<string, unknown>);
  const count = entries.length;

  if (count === 0) {
    return (
      <span>
        <span style={{ color }}>&quot;{propKey}&quot;</span>
        <span style={{ color }}>:&nbsp;</span>
        <span>
          {isArray ? "[]" : "{}"}
          {maybeComma(isLastItemInParent)}
        </span>
      </span>
    );
  }

  const effectiveDefaultOpen =
    isParentArrayItem && typeof data === "object" && !Array.isArray(data)
      ? true
      : depth < defaultExpandDepth;

  return (
    <Disclosure defaultOpen={effectiveDefaultOpen}>
      {({ open }) => (
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <DisclosureButton
            as="div"
            role="button"
            style={{
              alignItems: "baseline",
              cursor: "pointer",
              display: "flex",
              padding: "2px 0",
              position: "relative",
            }}
          >
            <span
              className="text-slate-600 dark:text-slate-400"
              style={{
                left: "-16px",
                lineHeight: 1,
                position: "absolute",
                top: "0.35em",
              }}
            >
              {open ? (
                <ChevronDownIcon
                  className="inline-block"
                  height={8}
                  width={8}
                />
              ) : (
                <ChevronRightIcon
                  className="inline-block"
                  height={8}
                  width={8}
                />
              )}
            </span>
            <span style={{ color }}>&quot;{propKey}&quot;</span>
            <span style={{ color }}>:&nbsp;</span>
            <span>{isArray ? "[" : "{"}</span>
            {!open && (
              <>
                <span
                  className="text-slate-600 dark:text-slate-400"
                  style={{
                    fontStyle: "italic",
                    margin: "0 4px",
                  }}
                >
                  … {count} {isArray ? "item" : "key"}
                  {count !== 1 ? "s" : ""}
                </span>
                <span>
                  {isArray ? "]" : "}"}
                  {maybeComma(isLastItemInParent)}
                </span>
              </>
            )}
          </DisclosureButton>

          {open && (
            <>
              <DisclosurePanel
                as="div"
                static
                style={{
                  marginLeft: "1.5em",
                  paddingTop: "2px",
                  width: "100%",
                }}
              >
                {isArray
                  ? (data as unknown[]).map((item, i) => (
                      <div
                        key={i}
                        style={{
                          paddingBottom: "2px",
                          paddingTop: "2px",
                          position: "relative",
                        }}
                      >
                        <JSONNodeRenderer
                          data={item}
                          defaultExpandDepth={defaultExpandDepth}
                          depth={depth + 1}
                          isLastItemInParent={i === count - 1}
                          isParentArrayItem={true}
                          propKey={null}
                        />
                      </div>
                    ))
                  : (entries as [string, unknown][]).map(([key, value], i) => (
                      <div
                        key={key}
                        style={{
                          paddingBottom: "2px",
                          paddingTop: "2px",
                          position: "relative",
                        }}
                      >
                        <JSONNodeRenderer
                          data={value}
                          defaultExpandDepth={
                            isParentArrayItem &&
                            typeof data === "object" &&
                            !Array.isArray(data)
                              ? depth + 1
                              : defaultExpandDepth
                          }
                          depth={depth + 1}
                          isLastItemInParent={i === count - 1}
                          isParentArrayItem={false}
                          propKey={key}
                        />
                      </div>
                    ))}
              </DisclosurePanel>
              <div style={{ paddingBottom: "2px", paddingTop: "2px" }}>
                <span>
                  {isArray ? "]" : "}"}
                  {maybeComma(isLastItemInParent)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Disclosure>
  );
}

function maybeComma(isLast: boolean) {
  return isLast ? null : (
    <span style={{ color: "var(--color-text-secondary, #6b7280)" }}>,</span>
  );
}

function renderValue(
  data: unknown,
  valueColor: (type: string) => string,
  isLastItemInParent: boolean,
  depth: number,
  defaultExpandDepth: number,
  isParentArrayItem?: boolean,
): React.ReactElement {
  if (data === null) {
    return (
      <span className={valueColor("null")} data-testid="json-null">
        null{maybeComma(isLastItemInParent)}
      </span>
    );
  }
  if (data === undefined) {
    return (
      <span className={valueColor("null")} data-testid="json-undefined">
        undefined{maybeComma(isLastItemInParent)}
      </span>
    );
  }
  if (typeof data === "string") {
    return (
      <span className={valueColor("string")} style={{ whiteSpace: "pre" }}>
        {JSON.stringify(data)}
        {maybeComma(isLastItemInParent)}
      </span>
    );
  }
  if (typeof data === "number") {
    return (
      <span className={valueColor("number")} data-testid="json-number">
        {data}
        {maybeComma(isLastItemInParent)}
      </span>
    );
  }
  if (typeof data === "boolean") {
    return (
      <span className={valueColor("boolean")} data-testid="json-boolean">
        {String(data)}
        {maybeComma(isLastItemInParent)}
      </span>
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray
    ? data
    : Object.entries(data as Record<string, unknown>);
  const count = entries.length;

  if (count === 0) {
    return (
      <span>
        {isArray ? "[]" : "{}"}
        {maybeComma(isLastItemInParent)}
      </span>
    );
  }

  const effectiveDefaultOpen =
    isParentArrayItem && typeof data === "object" && !Array.isArray(data)
      ? true
      : depth < defaultExpandDepth;

  return (
    <Disclosure defaultOpen={effectiveDefaultOpen}>
      {({ open }) => (
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <DisclosureButton
            as="div"
            role="button"
            style={{
              alignItems: "baseline",
              cursor: "pointer",
              display: "flex",
              padding: "2px 0",
              position: "relative",
            }}
          >
            <span
              className="text-slate-600 dark:text-slate-400"
              style={{
                left: "-16px",
                lineHeight: 1,
                position: "absolute",
                top: "0.35em",
              }}
            >
              {open ? (
                <ChevronDownIcon
                  className="inline-block"
                  height={8}
                  width={8}
                />
              ) : (
                <ChevronRightIcon
                  className="inline-block"
                  height={8}
                  width={8}
                />
              )}
            </span>
            <span>{isArray ? "[" : "{"}</span>
            {!open && (
              <>
                <span
                  className="text-slate-600 dark:text-slate-400"
                  style={{
                    fontStyle: "italic",
                    margin: "0 4px",
                  }}
                >
                  … {count} {isArray ? "item" : "key"}
                  {count !== 1 ? "s" : ""}
                </span>
                <span>{isArray ? "]" : "}"}</span>
                {maybeComma(isLastItemInParent)}
              </>
            )}
          </DisclosureButton>

          {open && (
            <>
              <DisclosurePanel
                as="div"
                static
                style={{
                  marginLeft: "1.5em",
                  paddingTop: "2px",
                  width: "100%",
                }}
              >
                {isArray
                  ? (data as unknown[]).map((item, i) => (
                      <div
                        key={i}
                        style={{
                          paddingBottom: "2px",
                          paddingTop: "2px",
                          position: "relative",
                        }}
                      >
                        <JSONNodeRenderer
                          data={item}
                          defaultExpandDepth={defaultExpandDepth}
                          depth={depth + 1}
                          isLastItemInParent={i === count - 1}
                          isParentArrayItem={true}
                          propKey={null}
                        />
                      </div>
                    ))
                  : (entries as [string, unknown][]).map(([key, value], i) => (
                      <div
                        key={key}
                        style={{
                          paddingBottom: "2px",
                          paddingTop: "2px",
                          position: "relative",
                        }}
                      >
                        <JSONNodeRenderer
                          data={value}
                          defaultExpandDepth={
                            isParentArrayItem &&
                            typeof data === "object" &&
                            !Array.isArray(data)
                              ? depth + 1
                              : defaultExpandDepth
                          }
                          depth={depth + 1}
                          isLastItemInParent={i === count - 1}
                          isParentArrayItem={false}
                          propKey={key}
                        />
                      </div>
                    ))}
              </DisclosurePanel>
              <div style={{ paddingBottom: "2px", paddingTop: "2px" }}>
                <span>{isArray ? "]" : "}"}</span>
                {maybeComma(isLastItemInParent)}
              </div>
            </>
          )}
        </div>
      )}
    </Disclosure>
  );
}

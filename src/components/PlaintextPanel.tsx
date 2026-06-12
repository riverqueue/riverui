import CopyablePanel from "@/components/CopyablePanel";

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
   * The title to show in the copy confirmation toast.
   * @default "Text"
   */
  copyTitle?: string;
  /**
   * The text to be displayed and copied.
   */
  text: string;
};

const styleConfig = {
  code: "block text-slate-800 dark:text-slate-200",
  pre: "m-0 whitespace-pre",
};

/**
 * A component that renders plaintext content with a copy button.
 */
export default function PlaintextPanel({
  className,
  codeClassName,
  copyTitle = "Text",
  text,
}: PlaintextPanelProps) {
  return (
    <CopyablePanel className={className} copyText={text} copyTitle={copyTitle}>
      <pre className={styleConfig.pre}>
        <code className={`${styleConfig.code} ${codeClassName || ""}`}>
          {text}
        </code>
      </pre>
    </CopyablePanel>
  );
}

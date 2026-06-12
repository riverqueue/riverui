import { useMemo } from "react";

import PlaintextPanel from "@/components/PlaintextPanel";
import { formatJSONText } from "@/utils/jsonText";

type JSONTextViewProps = {
  className?: string;
  copyTitle?: string;
  text: string;
};

export default function JSONTextView({
  className,
  copyTitle = "JSON",
  text,
}: JSONTextViewProps) {
  const formattedText = useMemo(() => formatJSONText(text), [text]);

  return (
    <PlaintextPanel
      className={className}
      codeClassName="whitespace-pre-wrap break-words"
      content={formattedText}
      copyTitle={copyTitle}
      rawText={formattedText}
    />
  );
}

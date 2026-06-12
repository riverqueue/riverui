import { useMemo } from "react";

import JSONView from "@/components/JSONView";
import PlaintextPanel from "@/components/PlaintextPanel";
import { prepareJSONText } from "@/utils/jsonText";

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
  const prepared = useMemo(() => prepareJSONText(text), [text]);

  if (prepared) {
    return (
      <JSONView
        className={className}
        copyText={prepared.copyText}
        copyTitle={copyTitle}
        data={prepared.value}
      />
    );
  }

  return (
    <PlaintextPanel
      className={className}
      codeClassName="whitespace-pre-wrap break-words"
      copyTitle={copyTitle}
      text={text}
    />
  );
}

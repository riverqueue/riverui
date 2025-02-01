import React, { useCallback, useEffect, useRef } from "react";
import { classNames } from "@utils/style";

export function CustomCheckbox({
  checked,
  className,
  onChange,
  indeterminate,
  ...props
}: {
  className?: string;
  indeterminate?: boolean;
  onChange?: (
    checked: boolean,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className" | "onChange" | "type"
>) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const controlledOnChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(!checked, event);
      }
    },
    [checked, onChange]
  );

  return (
    <input
      ref={checkboxRef}
      checked={checked}
      className={classNames(
        "h-4 w-4 rounded-sm border-slate-300 text-brand-primary focus:ring-indigo-600",
        // Background color applied to control in dark mode
        "dark:bg-white/5 dark:border-slate-700",
        className || ""
      )}
      onChange={controlledOnChange}
      type="checkbox"
      {...props}
    />
  );
}
